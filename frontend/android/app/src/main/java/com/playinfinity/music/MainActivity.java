package com.playinfinity.music;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MusicPlugin.class);
        super.onCreate(savedInstanceState);
    }
}