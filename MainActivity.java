package com.ujai.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(UJNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
