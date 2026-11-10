Shader "Gongang/Nightscape"
{
    Properties
    {
        _Twilight ("Twilight", Range(0,1)) = 0
        _StarBrightness ("Stars", Range(0,2)) = 1
        _CloudCover ("Cloud Cover", Range(0,1)) = 0.55
        _Shower ("Meteor Shower", Range(0,1)) = 0
        _Look ("Camera Look", Vector) = (0,0,0,0)
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Background" "IgnoreProjector"="True" }
        Cull Off
        ZWrite Off
        ZTest Always

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #include "UnityCG.cginc"

            float _Twilight;
            float _StarBrightness;
            float _CloudCover;
            float _Shower;
            float4 _Look;

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };
            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 uv : TEXCOORD0;
            };

            v2f vert (appdata input)
            {
                v2f output;
                output.vertex = UnityObjectToClipPos(input.vertex);
                output.uv = input.uv;
                return output;
            }

            float hash21(float2 p)
            {
                p = frac(p * float2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return frac(p.x * p.y);
            }

            float noise2(float2 p)
            {
                float2 i = floor(p);
                float2 f = frac(p);
                float2 u = f * f * (3.0 - 2.0 * f);
                return lerp(
                    lerp(hash21(i), hash21(i + float2(1,0)), u.x),
                    lerp(hash21(i + float2(0,1)), hash21(i + 1), u.x), u.y);
            }

            float fbm(float2 p)
            {
                float a = 0.5;
                float v = 0;
                [unroll] for (int j = 0; j < 4; j++)
                {
                    v += a * noise2(p);
                    p = p * 2.07 + 12.81;
                    a *= 0.5;
                }
                return v;
            }

            // Seeded, naturally nonuniform stars, with restrained per-star scintillation.
            float starField(float2 uv, float2 tiles, float time)
            {
                float2 grid = uv * tiles;
                float2 cell = floor(grid);
                float2 jitter = float2(hash21(cell + 7.2), hash21(cell + 28.1)) - 0.5;
                float2 offset = frac(grid) - 0.5 - jitter * 0.82;
                float radius = length(offset);
                float seed = hash21(cell + 3.9);
                float visible = step(0.965, seed);
                float scintillation = 0.72 + 0.28 * sin(time * (0.7 + seed * 1.3) + seed * 31.0);
                float pinpoint = exp(-radius * 52.0);
                float halo = exp(-radius * 12.0) * 0.11;
                return visible * (pinpoint + halo) * scintillation
                    * (0.6 + 1.2 * hash21(cell + 50.0));
            }

            float cloudDensity(float2 uv, float time)
            {
                float2 p = float2(uv.x * 3.7 - time * 0.007, uv.y * 5.4);
                float large = fbm(p + float2(11.3, 2.7));
                float wisps = fbm(p * float2(1.6, 2.1) + 17.2);
                float zone = exp(-pow((uv.y - 0.62) / 0.25, 2.0));
                float zoneLow = exp(-pow((uv.y - 0.34) / 0.18, 2.0));
                float fog = smoothstep(0.53, 0.77, large * 0.86 + wisps * 0.34);
                return saturate(fog * (zone + zoneLow * 0.5));
            }

            float2 meteorHead(float time, float seed)
            {
                float frequency = 7.0 + seed * 5.0;
                float phase = frac(time / frequency + hash21(float2(seed, 3.8)));
                return float2(1.24 - phase * 1.88 - seed * 0.28,
                              1.21 - phase * 1.25 + seed * 0.09);
            }

            float meteor(float2 uv, float time, float seed)
            {
                float frequency = 7.0 + seed * 5.0;
                float phase = frac(time / frequency + hash21(float2(seed, 3.8)));
                float2 head = meteorHead(time, seed);
                float2 diff = uv - head;
                float2 dir = normalize(float2(0.84, 0.54));
                float along = dot(diff, dir);
                float perpendicular = abs(dot(diff, float2(-dir.y, dir.x)));
                float streak = exp(-perpendicular * 270.0)
                    * step(0.0, along) * (1.0 - smoothstep(0.04, 0.34, along));
                float glow = exp(-length(diff) * 110.0);
                float active = smoothstep(0.08, 0.15, phase)
                    * (1.0 - smoothstep(0.54, 0.74, phase));
                return active * (streak + glow * 0.6);
            }

            // Smooth, stratified ridgelines rather than repeating triangular polygons.
            float distantRidge(float x)
            {
                return 0.337 + 0.060 * sin(x * 5.2 + 0.4)
                    + 0.032 * sin(x * 12.9 - 1.6)
                    + 0.019 * sin(x * 28.1 + 2.1)
                    + (noise2(float2(x * 15.0, 3.2)) - 0.5) * 0.025;
            }

            float middleRidge(float x)
            {
                return 0.248 + 0.051 * sin(x * 7.6 + 2.2)
                    + 0.025 * sin(x * 17.0 + 0.7)
                    + 0.012 * sin(x * 31.0 - 1.2);
            }

            float foregroundRidge(float x)
            {
                return 0.152 + 0.031 * sin(x * 10.5 - 0.5)
                    + 0.016 * sin(x * 24.5 + 0.4)
                    + 0.010 * sin(x * 53.0 + 0.9);
            }

            fixed4 frag(v2f i) : SV_Target
            {
                float2 uv = i.uv + _Look.xy * float2(0.042, 0.024);
                float2 screenUV = i.uv;
                float time = _Time.y;
                float twilight = saturate(_Twilight);

                // Deep blue zenith; a warm haze breathes over the horizon.
                float gradient = pow(saturate(1.0 - uv.y), 1.65);
                float3 zenith = float3(0.008, 0.018, 0.078);
                float3 horizon = float3(0.075, 0.147, 0.238);
                float3 sky = lerp(zenith, horizon, gradient);

                // Dim, diffuse Milky Way, visible without a fluorescent stripe.
                float galacticAxis = uv.x * 0.77 + uv.y * 0.38 - 0.73;
                float galactic = exp(-pow(galacticAxis / 0.16, 2.0))
                    * (0.46 + 0.54 * fbm(uv * 9.0 + 4.0));
                sky += float3(0.035, 0.053, 0.095) * galactic
                    * smoothstep(0.25, 0.58, uv.y);

                // Moonlight with a soft atmospheric halo.
                float2 moonPos = float2(0.77, 0.79);
                float2 moonDistortion = (uv - moonPos) * float2(1.0, 1.65);
                float moonDistance = length(moonDistortion);
                float moonBody = 1.0 - smoothstep(0.031, 0.036, moonDistance);
                float moonGlow = exp(-moonDistance * 10.0) * 0.23
                    + exp(-moonDistance * 35.0) * 0.19;
                sky += float3(0.46, 0.63, 0.91) * moonGlow;
                sky = lerp(sky, float3(0.91, 0.94, 1.0), moonBody * 0.91);

                float clouds = cloudDensity(uv, time) * _CloudCover;
                float cloudLight = fbm(uv * 6.0 + float2(-time * 0.009, 4.0));
                float3 cloudTint = lerp(float3(0.10, 0.15, 0.24),
                    float3(0.26, 0.31, 0.43), cloudLight);
                cloudTint += float3(0.08, 0.095, 0.11)
                    * exp(-moonDistance * 5.0);
                sky = lerp(sky, cloudTint, clouds * 0.46);

                float starMask = smoothstep(0.27, 0.47, uv.y);
                float stars = starField(uv, float2(105, 62), time)
                    + 0.75 * starField(uv + 0.127, float2(64, 39), time + 3.0)
                    + 0.47 * starField(uv + 0.337, float2(165, 101), time - 9.0);
                sky += float3(0.69, 0.81, 1.00) * stars
                    * _StarBrightness * starMask * (1.0 - clouds * 0.78)
                    * (1.0 - twilight * 0.84);

                float shooting = meteor(uv, time, 0.17) * 0.8;
                shooting += _Shower * (
                    meteor(uv, time * 1.34, 0.43)
                    + meteor(uv, time * 1.47, 0.69)
                    + meteor(uv, time * 1.26, 0.87));
                sky += shooting * float3(0.45, 0.70, 1.00)
                    * starMask * (1.0 - clouds * 0.3);

                float warmth = pow(saturate(1.0 - uv.y), 2.8) * twilight;
                sky = lerp(sky, float3(0.63, 0.22, 0.31), warmth * 0.80);
                sky += float3(0.31, 0.11, 0.08) * warmth * 0.20;

                // Three depth planes: far lavender mountains, teal foothills,
                // and near-dark vegetation. Edges remain organic and continuous.
                float hFar = distantRidge(uv.x);
                float hMid = middleRidge(uv.x);
                float hNear = foregroundRidge(uv.x);
                float farMask = 1.0 - smoothstep(hFar - 0.002, hFar + 0.003, uv.y);
                float midMask = 1.0 - smoothstep(hMid - 0.002, hMid + 0.003, uv.y);
                float nearMask = 1.0 - smoothstep(hNear - 0.002, hNear + 0.003, uv.y);

                float mist = exp(-pow((uv.y - hFar) / 0.055, 2.0));
                sky += float3(0.09, 0.15, 0.22) * mist * 0.20;

                float3 distant = float3(0.079, 0.112, 0.181)
                    + float3(0.025, 0.024, 0.043)
                    * noise2(uv * float2(39, 22));
                float3 middle = float3(0.027, 0.077, 0.114)
                    + float3(0.018, 0.025, 0.028)
                    * noise2(uv * float2(57, 24));
                float3 foreground = float3(0.014, 0.040, 0.065)
                    + float3(0.009, 0.015, 0.012)
                    * noise2(uv * float2(75, 33));

                sky = lerp(sky, distant, farMask);
                sky = lerp(sky, middle, midMask);
                sky = lerp(sky, foreground, nearMask);

                // Low valley water, with slow layered moonlit ripples.
                float waterMask = 1.0 - smoothstep(0.078, 0.087, uv.y);
                float ripple = sin(uv.y * 210.0
                    + sin(uv.x * 17.0 + time * 0.11) * 2.0
                    - time * 0.29);
                float reflectionCenter = exp(-pow((uv.x - moonPos.x) / 0.17, 2.0));
                float reflection = pow(saturate(ripple * 0.5 + 0.5), 9.0)
                    * reflectionCenter
                    * (0.3 + 0.7 * noise2(float2(uv.x * 31.0, uv.y * 84.0 - time * 0.3)));
                float3 water = float3(0.012, 0.039, 0.073)
                    + float3(0.19, 0.29, 0.41) * reflection * 0.47;
                sky = lerp(sky, water, waterMask);

                // Gentle vignette and film texture (no white flashes).
                float vignette = 1.0 - 0.22 * dot((screenUV - 0.5) * 1.4,
                    (screenUV - 0.5) * 1.4);
                sky *= vignette;
                float grain = hash21(floor(screenUV * _ScreenParams.xy
                    + float2(time * 17.0, time * 31.0))) - 0.5;
                sky += grain * 0.005;

                return fixed4(saturate(sky), 1.0);
            }
            ENDCG
        }
    }
    Fallback Off
}
