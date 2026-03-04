package com.playinfinity.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.pm.ServiceInfo;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;

import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.DefaultLoadControl;
import com.google.android.exoplayer2.LoadControl;
import com.google.android.exoplayer2.PlaybackException;
import com.google.android.exoplayer2.Player;
import com.google.android.exoplayer2.audio.AudioAttributes;
import com.google.android.exoplayer2.ui.PlayerNotificationManager;
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource;
import com.google.android.exoplayer2.source.DefaultMediaSourceFactory;
import com.google.android.exoplayer2.util.MimeTypes;

import android.support.v4.media.session.MediaSessionCompat;
import com.getcapacitor.JSObject;

public class MusicService extends Service {

    private static final String CHANNEL_ID = "music_playback_v2";
    private static final int NOTIFICATION_ID = 1;
    public static final String ACTION_PLAY = "com.playinfinity.music.action.PLAY";
    public static final String ACTION_PAUSE = "com.playinfinity.music.action.PAUSE";
    public static final String ACTION_RESUME = "com.playinfinity.music.action.RESUME";
    public static final String ACTION_STOP = "com.playinfinity.music.action.STOP";

    private ExoPlayer player;
    private MediaSessionCompat mediaSession;
    private PlayerNotificationManager playerNotificationManager;
    private String currentUrl;
    private String fallbackUrl;
    private boolean fallbackTried;
    private String currentTitle = "Play Infinity";
    private String currentArtist = "Unknown Artist";
    private String currentThumbnail;
    private Bitmap currentBitmap;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable statusUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            if (player != null && (player.isPlaying() || player.isLoading())) {
                sendPlaybackStatus();
            }
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        initializePlayer();
        initializeMediaSession();
        initializePlayerNotificationManager();
        handler.post(statusUpdateRunnable);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startInForeground();

        if (intent == null) {
            return START_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_PAUSE.equals(action)) {
            player.pause();
            return START_STICKY;
        }

        if (ACTION_RESUME.equals(action)) {
            player.play();
            return START_STICKY;
        }

        if (ACTION_STOP.equals(action)) {
            player.stop();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String url = intent.getStringExtra("url");
        String newFallbackUrl = intent.getStringExtra("fallbackUrl");
        if (newFallbackUrl != null && !newFallbackUrl.isEmpty()) {
            fallbackUrl = newFallbackUrl;
        }

        String newTitle = intent.getStringExtra("title");
        String newArtist = intent.getStringExtra("artist");
        String newThumbnail = intent.getStringExtra("thumbnail");

        if (newTitle != null) currentTitle = newTitle;
        if (newArtist != null) currentArtist = newArtist;
        if (newThumbnail != null) {
            if (!newThumbnail.equals(currentThumbnail)) {
                currentThumbnail = newThumbnail;
                currentBitmap = null; // reset for new fetch
            }
        }

        if (url != null && !url.isEmpty()) {
            playUrl(url);
        } else if (ACTION_PLAY.equals(action)) {
            player.play();
        }

        if (playerNotificationManager != null) {
            playerNotificationManager.invalidate();
        }

        MediaButtonReceiver.handleIntent(mediaSession, intent);
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

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (player != null && player.isPlaying() && currentUrl != null && !currentUrl.isEmpty()) {
            Intent restartIntent = new Intent(getApplicationContext(), MusicService.class);
            restartIntent.putExtra("url", currentUrl);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(restartIntent);
            } else {
                startService(restartIntent);
            }
        }
        super.onTaskRemoved(rootIntent);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void initializePlayer() {
        DefaultHttpDataSource.Factory dataSourceFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36")
                .setAllowCrossProtocolRedirects(true);

        DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(this)
                .setDataSourceFactory(dataSourceFactory);

        // Fast Load Control config
        LoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                        15000, // Min Buffer
                        50000, // Max Buffer
                        2500,  // Buffer for Playback
                        5000   // Buffer for Playback after Rebuffer
                )
                .build();

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(mediaSourceFactory)
                .setLoadControl(loadControl)
                .build();

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build();

        player.setAudioAttributes(audioAttributes, true);
        player.setWakeMode(C.WAKE_MODE_NETWORK);
        player.setHandleAudioBecomingNoisy(true);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlayerError(PlaybackException error) {
                if (!fallbackTried && fallbackUrl != null && !fallbackUrl.isEmpty()
                        && (currentUrl == null || !fallbackUrl.equals(currentUrl))) {
                    fallbackTried = true;
                    playUrl(fallbackUrl);
                }
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                sendPlaybackStatus();
            }
        });
    }

    private void sendPlaybackStatus() {
        if (player == null) return;
        
        JSObject data = new JSObject();
        data.put("position", player.getCurrentPosition() / 1000);
        data.put("duration", player.getDuration() / 1000);
        data.put("isPlaying", player.isPlaying());
        
        Intent intent = new Intent("com.playinfinity.music.PLAYBACK_STATUS");
        intent.putExtra("position", (long)(player.getCurrentPosition() / 1000));
        intent.putExtra("duration", (long)(player.getDuration() / 1000));
        intent.putExtra("isPlaying", player.isPlaying());
        sendBroadcast(intent);
    }

    private void initializeMediaSession() {
        mediaSession = new MediaSessionCompat(this, "PlayInfinitySession");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                player.play();
            }

            @Override
            public void onPause() {
                player.pause();
            }

            @Override
            public void onStop() {
                player.stop();
                stopForeground(true);
                stopSelf();
            }
        });
        mediaSession.setActive(true);
    }

    private void initializePlayerNotificationManager() {
        PlayerNotificationManager.MediaDescriptionAdapter descriptionAdapter =
                new PlayerNotificationManager.MediaDescriptionAdapter() {
                    @Override
                    public String getCurrentContentTitle(com.google.android.exoplayer2.Player player) {
                        return currentTitle;
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
                        return currentArtist;
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
                        if (currentBitmap != null) return currentBitmap;
                        
                        if (currentThumbnail != null) {
                            new Thread(() -> {
                                try {
                                    URL url = new URL(currentThumbnail);
                                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                                    connection.setDoInput(true);
                                    connection.connect();
                                    InputStream input = connection.getInputStream();
                                    Bitmap myBitmap = BitmapFactory.decodeStream(input);
                                    handler.post(() -> {
                                        currentBitmap = myBitmap;
                                        callback.onBitmap(myBitmap);
                                    });
                                } catch (Exception e) {
                                    e.printStackTrace();
                                }
                            }).start();
                        }
                        return null;
                    }
                };

        PlayerNotificationManager.NotificationListener notificationListener =
                new PlayerNotificationManager.NotificationListener() {
                    @Override
                    public void onNotificationPosted(int notificationId, Notification notification, boolean ongoing) {
                        if (ongoing) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                            } else {
                                startForeground(notificationId, notification);
                            }
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
        playerNotificationManager.setSmallIcon(android.R.drawable.ic_media_play);
        playerNotificationManager.setPriority(NotificationCompat.PRIORITY_DEFAULT);
        playerNotificationManager.setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        playerNotificationManager.setUseChronometer(true);
        playerNotificationManager.setUseFastForwardAction(true);
        playerNotificationManager.setUseRewindAction(true);
        playerNotificationManager.setUseNextAction(true);
        playerNotificationManager.setUsePreviousAction(true);
        playerNotificationManager.setPlayer(player);
    }

    private Notification buildInitialNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Play Infinity")
                .setContentText("Starting playback...")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .build();
    }

    private void startInForeground() {
        Notification notification = buildInitialNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Playback controls");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setImportance(NotificationManager.IMPORTANCE_HIGH);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(false);
        channel.setShowBadge(true);

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private void playUrl(String url) {
        currentUrl = url;
        fallbackTried = false;
        
        MediaItem.Builder builder = new MediaItem.Builder().setUri(url);
        // Force MIME type for better stream detection
        if (url.contains("googlevideo") || url.contains("piped") || url.contains("vercel")) {
            builder.setMimeType(MimeTypes.AUDIO_MP4);
        }
        
        player.setMediaItem(builder.build());
        player.prepare();
        player.play();
    }
}
