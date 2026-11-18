package com.ujai.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.service.voice.VoiceInteractionSession;
import android.service.voice.VoiceInteractionSessionService;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** A visible system-assistant panel. It deliberately does not listen for a wake word. */
public class UJVoiceInteractionSessionService extends VoiceInteractionSessionService {
    @Override public VoiceInteractionSession onNewSession(android.os.Bundle args) {
        return new UJVoiceInteractionSession(this);
    }

    static class UJVoiceInteractionSession extends VoiceInteractionSession {
        private final Context context;

        UJVoiceInteractionSession(Context context) {
            super(context);
            this.context = context;
        }

        @Override public View onCreateContentView() {
            LinearLayout panel = new LinearLayout(context);
            panel.setOrientation(LinearLayout.VERTICAL);
            panel.setGravity(Gravity.CENTER);
            int pad = (int) (24 * context.getResources().getDisplayMetrics().density);
            panel.setPadding(pad, pad, pad, pad);

            TextView title = new TextView(context);
            title.setText("UJ AI");
            title.setTextSize(26);
            title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            title.setGravity(Gravity.CENTER);
            panel.addView(title, new LinearLayout.LayoutParams(-1, -2));

            TextView description = new TextView(context);
            description.setText("आपका असिस्टेंट तैयार है। पूरी बातचीत के लिए UJ AI खोलें।");
            description.setTextSize(16);
            description.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams descriptionParams = new LinearLayout.LayoutParams(-1, -2);
            descriptionParams.topMargin = pad / 2;
            panel.addView(description, descriptionParams);

            Button open = new Button(context);
            open.setText("UJ AI खोलें");
            open.setOnClickListener(v -> openApp());
            LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(-1, -2);
            buttonParams.topMargin = pad;
            panel.addView(open, buttonParams);
            return panel;
        }

        @Override public void onShow(android.os.Bundle args, int showFlags) {
            super.onShow(args, showFlags);
        }

        private void openApp() {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(launch);
            hide();
        }
    }
}
