package com.ujai.app;

import android.app.role.RoleManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "UJNative")
public class UJNativePlugin extends Plugin {

@PluginMethod
public void getNativeInfo(PluginCall call) {
    JSObject result = new JSObject();
    result.put("native", true);
    result.put("manufacturer", Build.MANUFACTURER);
    result.put("model", Build.MODEL);
    result.put("sdk", Build.VERSION.SDK_INT);
    result.put("assistantRoleSupported", Build.VERSION.SDK_INT >= 29);
    call.resolve(result);
}

@PluginMethod
public void requestAssistantRole(PluginCall call) {
    if (Build.VERSION.SDK_INT < 29) {
        call.reject("Default Assistant role requires Android 10 or newer.");
        return;
    }

    RoleManager roles = getContext().getSystemService(RoleManager.class);

    if (roles == null || !roles.isRoleAvailable(RoleManager.ROLE_ASSISTANT)) {
        call.reject("इस Android version में Assistant role उपलब्ध नहीं है।");
        return;
    }

    if (roles.isRoleHeld(RoleManager.ROLE_ASSISTANT)) {
        JSObject result = new JSObject();
        result.put("isDefault", true);
        call.resolve(result);
        return;
    }

    try {
        startActivityForResult(
            call,
            roles.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT),
            "handleAssistantRoleResult"
        );
    } catch (Exception e) {
        call.reject("Assistant role request could not be opened.", e);
    }
}

@ActivityCallback
private void handleAssistantRoleResult(PluginCall call, ActivityResult result) {
    if (call == null) return;

    RoleManager roles = getContext().getSystemService(RoleManager.class);
    JSObject data = new JSObject();
    data.put("isDefault",
        roles != null && roles.isRoleHeld(RoleManager.ROLE_ASSISTANT)
    );
    call.resolve(data);
}

@PluginMethod
public void openPhoneTarget(PluginCall call) {
    String target = call.getString("target", "");
    Intent intent = null;

    switch (target) {
        case "youtube":
            intent = getActivity().getPackageManager()
                .getLaunchIntentForPackage("com.google.android.youtube");
            break;
        case "whatsapp":
            intent = getActivity().getPackageManager()
                .getLaunchIntentForPackage("com.whatsapp");
            break;
        case "camera":
            intent = new Intent("android.media.action.IMAGE_CAPTURE");
            break;
        case "chrome":
            intent = getActivity().getPackageManager()
                .getLaunchIntentForPackage("com.android.chrome");
            break;
        case "settings":
            intent = new Intent(Settings.ACTION_SETTINGS);
            break;
        case "wifi":
            intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
            break;
        case "bluetooth":
            intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            break;
        case "dialer":
            intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:"));
            break;
        default:
            call.reject("Unsupported phone shortcut.");
            return;
    }

    if (intent == null) {
        call.reject("यह app फोन में install नहीं है या उपलब्ध नहीं है।");
        return;
    }

    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

    try {
        getActivity().startActivity(intent);
        call.resolve();
    } catch (ActivityNotFoundException e) {
        call.reject("फोन इस action को नहीं खोल सका।", e);
    }
}

}
