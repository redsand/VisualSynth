!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!pragma warning disable 6001

Var RemoveUserData
Var UserDataCheckbox

!macro VS_CustomUninstall
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 20u "VisualSynth user data is stored in your profile."
  ${NSD_CreateCheckbox} 0 26u 100% 12u "Remove VisualSynth user data (projects, presets, cache)"
  Pop $UserDataCheckbox
  nsDialogs::Show
  ${NSD_GetState} $UserDataCheckbox $RemoveUserData
  ${If} $RemoveUserData == ${BST_CHECKED}
    RMDir /r "$APPDATA\VisualSynth"
    RMDir /r "$LOCALAPPDATA\VisualSynth"
  ${EndIf}
!macroend

!macro customUnInstall
  !insertmacro VS_CustomUninstall
!macroend
