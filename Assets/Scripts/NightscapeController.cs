using System;
using System.IO;
using UnityEngine;

namespace Gongang.Unity
{
    /// <summary>
    /// Self-contained, procedural night-sky lookout.
    /// Open Assets/Scenes/Nightscape.unity, press Play, and enjoy.
    /// No external artwork, paid assets or render-pipeline packages are required.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class NightscapeController : MonoBehaviour
    {
        [Header("Atmosphere")]
        [Range(0f, 1f)] public float Twilight = 0.0f;
        [Range(0.2f, 1.8f)] public float StarBrightness = 1.0f;
        [Range(0f, 1f)] public float CloudCover = 0.55f;

        [Header("Meteor shower")]
        [Min(1f)] public float MeteorShowerDuration = 14f;

        private Material atmosphere;
        private Transform sky;
        private Camera viewCamera;
        private float showerUntil = -100f;
        private float smoothShower;
        private bool helpVisible = true;
        private float lastTouchTime = -100f;
        private float helpAutoHideAt;
        private Vector2 lookOffset;
        private Vector2 lookTarget;
        private Vector3 dragStart;
        private GUIStyle headingStyle;
        private GUIStyle instructionStyle;
        private bool createdCamera;

        private static readonly int ShowerId = Shader.PropertyToID("_Shower");
        private static readonly int TwilightId = Shader.PropertyToID("_Twilight");
        private static readonly int StarId = Shader.PropertyToID("_StarBrightness");
        private static readonly int CloudsId = Shader.PropertyToID("_CloudCover");
        private static readonly int LookId = Shader.PropertyToID("_Look");

        private void Awake()
        {
            PrepareScene();
            helpAutoHideAt = Time.unscaledTime + 10f;
        }

        private void PrepareScene()
        {
            if (viewCamera == null)
            {
                viewCamera = Camera.main;
                if (viewCamera == null)
                {
                    GameObject cameraObject = new GameObject("Nightscape Camera");
                    cameraObject.transform.SetParent(transform, false);
                    viewCamera = cameraObject.AddComponent<Camera>();
                    cameraObject.tag = "MainCamera";
                    createdCamera = true;
                }
            }

            viewCamera.orthographic = true;
            viewCamera.orthographicSize = 5f;
            viewCamera.nearClipPlane = 0.1f;
            viewCamera.farClipPlane = 100f;
            viewCamera.clearFlags = CameraClearFlags.SolidColor;
            viewCamera.backgroundColor = new Color(0.015f, 0.019f, 0.070f);
            viewCamera.transform.position = new Vector3(0f, 0f, -10f);
            viewCamera.transform.rotation = Quaternion.identity;
            viewCamera.allowHDR = true;

            Shader shader = Resources.Load<Shader>("Nightscape");
            if (shader == null)
            {
                Debug.LogError("Gongang: Assets/Resources/Nightscape.shader is missing.");
                enabled = false;
                return;
            }

            atmosphere = new Material(shader) { name = "Nightscape (runtime)" };
            GameObject plane = GameObject.CreatePrimitive(PrimitiveType.Quad);
            plane.name = "Procedural Landscape";
            plane.transform.SetParent(transform, false);
            plane.transform.localPosition = Vector3.zero;
            sky = plane.transform;
            Renderer planeRenderer = plane.GetComponent<Renderer>();
            planeRenderer.sharedMaterial = atmosphere;
            Collider collider = plane.GetComponent<Collider>();
            if (collider != null) Destroy(collider);
            ResizeSky();
            ApplyMaterial();
        }

        private void ResizeSky()
        {
            if (sky == null || viewCamera == null) return;
            float height = viewCamera.orthographicSize * 2f;
            float width = height * Mathf.Max(0.1f, viewCamera.aspect);
            sky.localScale = new Vector3(width, height, 1f);
        }

        private void Update()
        {
            if (atmosphere == null) return;

            if (Input.GetKeyDown(KeyCode.Space)) TriggerShower();
            if (Input.GetKeyDown(KeyCode.H)) helpVisible = !helpVisible;
            if (Input.GetKeyDown(KeyCode.T)) Twilight = Mathf.Approximately(Twilight, 0f) ? 0.58f : 0f;
            if (Input.GetKeyDown(KeyCode.P)) SavePhoto();
            if (Input.GetKeyDown(KeyCode.R)) lookTarget = Vector2.zero;

            // Mouse drag and mobile single-finger drag look subtly across the landscape.
            if (Input.GetMouseButtonDown(0)) dragStart = Input.mousePosition;
            if (Input.GetMouseButton(0))
            {
                Vector3 delta = Input.mousePosition - dragStart;
                if (delta.sqrMagnitude > 6f)
                {
                    lookTarget += new Vector2(delta.x / Screen.width, delta.y / Screen.height) * 0.9f;
                    lookTarget = Vector2.Max(new Vector2(-0.75f, -0.3f),
                        Vector2.Min(new Vector2(0.75f, 0.3f), lookTarget));
                    dragStart = Input.mousePosition;
                }
            }

            if (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began)
            {
                if (Time.unscaledTime - lastTouchTime < 0.33f) TriggerShower();
                lastTouchTime = Time.unscaledTime;
            }

            if (helpVisible && Time.unscaledTime > helpAutoHideAt)
                helpVisible = false;

            smoothShower = Mathf.MoveTowards(
                smoothShower,
                Time.time < showerUntil ? 1f : 0f,
                Time.deltaTime * (Time.time < showerUntil ? 0.9f : 0.4f));

            lookOffset = Vector2.Lerp(lookOffset, lookTarget, 1f - Mathf.Exp(-3f * Time.deltaTime));
            ResizeSky();
            ApplyMaterial();
        }

        public void TriggerShower()
        {
            showerUntil = Time.time + Mathf.Max(1f, MeteorShowerDuration);
            helpVisible = false;
        }

        private void ApplyMaterial()
        {
            if (atmosphere == null) return;
            atmosphere.SetFloat(ShowerId, smoothShower);
            atmosphere.SetFloat(TwilightId, Twilight);
            atmosphere.SetFloat(StarId, StarBrightness);
            atmosphere.SetFloat(CloudsId, CloudCover);
            atmosphere.SetVector(LookId, new Vector4(lookOffset.x, lookOffset.y, 0f, 0f));
        }

        public void SavePhoto()
        {
            try
            {
                string filename = "Gongang-Nightscape-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".png";
                string output = Path.Combine(Application.persistentDataPath, filename);
                ScreenCapture.CaptureScreenshot(output, 2);
                Debug.Log("Gongang photo: " + output);
            }
            catch (Exception exception)
            {
                Debug.LogError("Gongang screenshot failed: " + exception.Message);
            }
        }

        private void OnGUI()
        {
            if (atmosphere == null) return;
            if (headingStyle == null)
            {
                headingStyle = new GUIStyle(GUI.skin.label)
                {
                    fontSize = Mathf.Clamp(Mathf.RoundToInt(Screen.height * 0.023f), 15, 24),
                    fontStyle = FontStyle.Bold
                };
                headingStyle.normal.textColor = new Color(0.88f, 0.93f, 1f);
                instructionStyle = new GUIStyle(GUI.skin.label)
                {
                    fontSize = Mathf.Clamp(Mathf.RoundToInt(Screen.height * 0.015f), 11, 16),
                    wordWrap = true
                };
                instructionStyle.normal.textColor = new Color(0.75f, 0.83f, 0.96f);
            }

            // Tiny unobtrusive controls; the scene remains clear for photographs.
            float unit = Mathf.Clamp(Screen.height / 900f, 0.9f, 1.5f);
            float padding = 16f * unit;
            if (helpVisible)
            {
                float width = Mathf.Min(Screen.width - padding * 2, 390f * unit);
                GUI.Box(new Rect(padding, padding, width, 95f * unit), GUIContent.none);
                GUI.Label(new Rect(padding + 12, padding + 8, width - 20, 30 * unit),
                    "공강  ·  별이 머무는 밤", headingStyle);
                GUI.Label(new Rect(padding + 12, padding + 43, width - 20, 50 * unit),
                    "SPACE 유성우   T 노을   P 사진   H 안내 숨기기\n드래그: 시점 이동   R: 시점 초기화   모바일: 더블탭 유성우",
                    instructionStyle);
            }

            const float buttonWidth = 126f;
            const float buttonHeight = 35f;
            if (GUI.Button(new Rect(
                Screen.width - (buttonWidth + 18f) * unit,
                Screen.height - (buttonHeight + 18f) * unit,
                buttonWidth * unit, buttonHeight * unit), "✦ 유성우"))
            {
                TriggerShower();
            }
        }

        private void OnDestroy()
        {
            if (atmosphere != null) Destroy(atmosphere);
            // A dynamically generated camera belongs to this component's scene root.
            createdCamera = false;
        }
    }
}
