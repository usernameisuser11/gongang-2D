#if UNITY_EDITOR
using Gongang.Unity;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Gongang.Unity.EditorTools
{
    /// <summary>
    /// Fallback repair command if a Unity editor version rewrites the checked-in scene YAML.
    /// Never changes the original web project or an unrelated Unity scene.
    /// </summary>
    public static class NightscapeSceneSetup
    {
        [MenuItem("Gongang/Build or Repair Nightscape Scene")]
        public static void BuildScene()
        {
            const string output = "Assets/Scenes/Nightscape.unity";
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
                return;

            var scene = EditorSceneManager.NewScene(
                NewSceneSetup.EmptyScene, NewSceneMode.Single);
            GameObject root = new GameObject("Gongang Nightscape");
            root.AddComponent<NightscapeController>();
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, output);

            // Register only our scene to make the project playable.
            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(output, true)
            };

            Selection.activeGameObject = root;
            Debug.Log("Gongang nightscape scene prepared: " + output);
        }
    }
}
#endif
