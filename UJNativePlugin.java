package com.ujai.app;

import android.app.Activity;
import android.app.role.RoleManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.ContactsContract;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "UJNative")
public class UJNativePlugin extends Plugin {
    @PluginMethod public void getNativeInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("native", true);
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);
        result.put("sdk", Build.VERSION.SDK_INT);
        result.put("assistantRoleSupported", Build.VERSION.SDK_INT >= 29);
        call.resolve(result);
    }

    @PluginMethod public void requestAssistantRole(PluginCall call) {
        Activity activity = getActivity();
        if (Build.VERSION.SDK_INT < 29) {
            call.reject("Default Assistant role requires Android 10 or newer.");
            return;
        }
        RoleManager roles = activity.getSystemService(RoleManager.class);
        if (roles == null || !roles.isRoleAvailable(RoleManager.ROLE_ASSISTANT)) {
            call.reject("इस Android version में Assistant role उपलब्ध नहीं है।");
            return;
        }
        if (roles.isRoleHeld(RoleManager.ROLE_ASSISTANT)) {
            JSObject result = new JSObject(); result.put("isDefault", true); call.resolve(result); return;
        }
        try {
            startActivityForResult(call, roles.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT), result -> {
                JSObject data = new JSObject();
                data.put("isDefault", roles.isRoleHeld(RoleManager.ROLE_ASSISTANT));
                call.resolve(data);
            });
        } catch (Exception e) { call.reject("Assistant role request could not be opened.", e); }
    }

    @PluginMethod public void openPhoneTarget(PluginCall call) {
        String target = call.getString("target", "");
        Intent intent = null;
        switch (target) {
            case "youtube": intent = getActivity().getPackageManager().getLaunchIntentForPackage("com.google.android.youtube"); break;
            case "whatsapp": intent = getActivity().getPackageManager().getLaunchIntentForPackage("com.whatsapp"); break;
            case "camera": intent = new Intent("android.media.action.IMAGE_CAPTURE"); break;
            case "chrome": intent = getActivity().getPackageManager().getLaunchIntentForPackage("com.android.chrome"); break;
            case "settings": intent = new Intent(Settings.ACTION_SETTINGS); break;
            case "wifi": intent = new Intent(Settings.ACTION_WIFI_SETTINGS); break;
            case "bluetooth": intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS); break;
            case "dialer": intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:")); break;
            case "messages": intent = new Intent(Intent.ACTION_MAIN); intent.addCategory(Intent.CATEGORY_APP_MESSAGING); break;
            case "sms": intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:")); break;
            case "contacts": intent = new Intent(Intent.ACTION_VIEW, ContactsContract.Contacts.CONTENT_URI); break;
            case "maps": intent = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(call.getString("query", "")))); break;
            case "clock": intent = new Intent(Intent.ACTION_SHOW_ALARMS); break;
            case "alarm":
                intent = new Intent(AlarmClock.ACTION_SET_ALARM);
                intent.putExtra(AlarmClock.EXTRA_SKIP_UI, false);
                break;
            case "calendar":
                intent = new Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI);
                intent.putExtra(CalendarContract.Events.TITLE, "");
                break;
            case "email": intent = new Intent(Intent.ACTION_MAIN); intent.addCategory(Intent.CATEGORY_APP_EMAIL); break;
            default: call.reject("Unsupported phone shortcut."); return;
        }
        if (intent == null) { call.reject("यह app फोन में install नहीं है या उपलब्ध नहीं है।"); return; }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getActivity().startActivity(intent); call.resolve(); }
        catch (ActivityNotFoundException e) { call.reject("फोन इस action को नहीं खोल सका।", e); }
    }
}
