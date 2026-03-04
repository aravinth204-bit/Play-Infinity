package com.playinfinity.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;

import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.audio.AudioAttributes;
import com.google.android.exoplayer2.ui.PlayerNotificationManager;

import android.support.v4.media.session.MediaSessionCompat;

public class MusicService extends Service {

    private static final String CHANNEL_ID = "music_channel";
    private static final int NOTIFICATION_ID = 1;

    private ExoPlayer player;
    private MediaSessionCompat mediaSession;
    private PlayerNotificationManager playerNotificationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        initializePlayer();
        initializeMediaSession();
        initializePlayerNotificationManager();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildInitialNotification());

        if (intent != null) {
            String url = intent.getStringExtra("url");
            if (url != null && !url.isEmpty()) {
                MediaItem mediaItem = MediaItem.fromUri(url);
                player.setMediaItem(mediaItem);
                player.prepare();
                player.play();
            }

            MediaButtonReceiver.handleIntent(mediaSession, intent);
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (playerNotificationManager != null) {
            playerNotificationManager.setPlayer(null);
        }

        if (mediaSession != null) {
            mediaSession.release();
        }

        if (player != null) {
            player.release();
        }

        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void initializePlayer() {
        player = new ExoPlayer.Builder(this).build();

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build();

        player.setAudioAttributes(audioAttributes, true);
        player.setWakeMode(C.WAKE_MODE_NETWORK);
    }

    private void initializeMediaSession() {
        mediaSession = new MediaSessionCompat(this, "PlayInfinitySession");
        mediaSession.setActive(true);
    }

    private void initializePlayerNotificationManager() {
        PlayerNotificationManager.MediaDescriptionAdapter descriptionAdapter =
                new PlayerNotificationManager.MediaDescriptionAdapter() {
                    @Override
                    public String getCurrentContentTitle(com.google.android.exoplayer2.Player player) {
                        return "Play Infinity";
                    }

                    @Nullable
                    @Override
                    public PendingIntent createCurrentContentIntent(com.google.android.exoplayer2.Player player) {
                        Intent openAppIntent = new Intent(MusicService.this, MainActivity.class);
                        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                                : PendingIntent.FLAG_UPDATE_CURRENT;
                        return PendingIntent.getActivity(MusicService.this, 0, openAppIntent, flags);
                    }

                    @Nullable
                    @Override
                    public String getCurrentContentText(com.google.android.exoplayer2.Player player) {
                        return player.isPlaying() ? "Music Playing..." : "Music Paused";
                    }

                    @Nullable
                    @Override
                    public String getCurrentSubText(com.google.android.exoplayer2.Player player) {
                        return null;
                    }

                    @Nullable
                    @Override
                    public android.graphics.Bitmap getCurrentLargeIcon(
                            com.google.android.exoplayer2.Player player,
                            PlayerNotificationManager.BitmapCallback callback
                    ) {
                        return null;
                    }
                };

        PlayerNotificationManager.NotificationListener notificationListener =
                new PlayerNotificationManager.NotificationListener() {
                    @Override
                    public void onNotificationPosted(int notificationId, Notification notification, boolean ongoing) {
                        if (ongoing) {
                            startForeground(notificationId, notification);
                        } else {
                            stopForeground(false);
                        }
                    }

                    @Override
                    public void onNotificationCancelled(int notificationId, boolean dismissedByUser) {
                        stopForeground(true);
                        stopSelf();
                    }
                };

        playerNotificationManager = new PlayerNotificationManager.Builder(
                this,
                NOTIFICATION_ID,
                CHANNEL_ID
        )
                .setMediaDescriptionAdapter(descriptionAdapter)
                .setNotificationListener(notificationListener)
                .build();

        playerNotificationManager.setMediaSessionToken(mediaSession.getSessionToken());
        playerNotificationManager.setUseChronometer(true);
        playerNotificationManager.setUseFastForwardAction(false);
        playerNotificationManager.setUseRewindAction(false);
        playerNotificationManager.setPlayer(player);
    }

    private Notification buildInitialNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Play Infinity")
                .setContentText("Starting playback...")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Playback controls");

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
