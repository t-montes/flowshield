import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AudioSession,
  LiveKitRoom,
  registerGlobals,
  useParticipants,
  useRoomContext
} from '@livekit/react-native';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

// Register WebRTC globals
registerGlobals();

// Environment variables
const LIVEKIT_URL = Constants.expoConfig?.extra?.LIVEKIT_URL || process.env.LIVEKIT_URL;
const LIVEKIT_JWT = Constants.expoConfig?.extra?.LIVEKIT_JWT || process.env.LIVEKIT_JWT;

interface TranscriptMessage {
  id: string;
  text: string;
  participant: string;
  timestamp: Date;
  isUser: boolean;
}

// Main component that renders the LiveKit room when connected
function VoiceAssistant({ onDisconnect }: { onDisconnect: () => void }) {
  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL!}
      token={LIVEKIT_JWT!}
      connect={true}
      options={{
        adaptiveStream: { pixelDensity: 'screen' },
      }}
      audio={true}
      video={false}
    >
      <RoomContent onDisconnect={onDisconnect} />
    </LiveKitRoom>
  );
}

// Component that uses LiveKit hooks inside the LiveKitRoom
function RoomContent({ onDisconnect }: { onDisconnect: () => void }) {
  const participants = useParticipants();
  const room = useRoomContext();
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      // Add welcome message when first connected
      addTranscriptMessage("Connected to FlowShield Assistant! Start speaking...", "System", false);
      setIsInitialized(true);
    }
  }, [isInitialized]);

  useEffect(() => {
    // Track participant changes
    if (participants.length > 0) {
      console.log(`Connected with ${participants.length} participant(s)`);
      participants.forEach(participant => {
        addTranscriptMessage(`Assistant ${participant.identity} is in the room`, 'System', false);
      });
    }
  }, [participants]);

  useEffect(() => {
    if (!room) return;

    // Handle data messages for transcriptions (if the agent sends them)
    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        console.log('Data received:', data);
        
        if (data.type === 'transcription') {
          const isUser = participant?.identity === 'user' || !participant;
          addTranscriptMessage(data.text, participant?.identity || 'User', isUser);
        }
      } catch (error) {
        console.error('Error parsing data message:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);

    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room]);

  const addTranscriptMessage = (text: string, participant: string, isUser: boolean) => {
    const newMessage: TranscriptMessage = {
      id: Date.now().toString() + Math.random(),
      text,
      participant,
      timestamp: new Date(),
      isUser
    };
    
    setTranscripts(prev => [...prev, newMessage]);
  };

  const clearTranscripts = () => {
    setTranscripts([]);
  };


  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedText type="title">FlowShield Voice Assistant</ThemedText>
        <ThemedText style={styles.subtitle}>
          Connected - Speak to interact with the assistant
        </ThemedText>
      </ThemedView>

      {/* Connection Status */}
      <ThemedView style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.disconnectButton]}
          onPress={onDisconnect}
        >
          <ThemedText style={styles.buttonText}>Disconnect</ThemedText>
        </TouchableOpacity>
        
        {transcripts.length > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={clearTranscripts}
          >
            <ThemedText style={styles.buttonText}>Clear Chat</ThemedText>
          </TouchableOpacity>
        )}
      </ThemedView>

      {/* Participants Info */}
      <ThemedView style={styles.participantInfo}>
        <ThemedText>Participants: {participants.length + 1}</ThemedText>
        <ThemedText>Status: Connected</ThemedText>
      </ThemedView>

      {/* Transcript Display */}
      <ThemedView style={styles.transcriptContainer}>
        <ThemedText type="subtitle" style={styles.transcriptTitle}>Conversation</ThemedText>
        <ScrollView 
          style={styles.transcriptScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.transcriptContent}
        >
          {transcripts.length === 0 ? (
            <ThemedView style={styles.emptyState}>
              <ThemedText style={styles.emptyText}>
                Conversation will appear here as you speak...
              </ThemedText>
            </ThemedView>
          ) : (
            transcripts.map((message) => (
              <View key={message.id} style={[
                styles.messageContainer,
                message.isUser ? styles.userMessage : styles.assistantMessage
              ]}>
                <ThemedText style={[
                  styles.participantName,
                  message.isUser ? styles.userParticipant : styles.assistantParticipant
                ]}>
                  {message.isUser ? 'You' : message.participant}
                </ThemedText>
                <ThemedText style={styles.messageText}>{message.text}</ThemedText>
                <ThemedText style={styles.timestamp}>
                  {message.timestamp.toLocaleTimeString()}
                </ThemedText>
              </View>
            ))
          )}
        </ScrollView>
      </ThemedView>

      {/* Status Bar */}
      <ThemedView style={styles.statusBar}>
        <View style={[styles.statusIndicator, styles.connectedIndicator]} />
        <ThemedText style={styles.statusText}>Live</ThemedText>
        <ThemedText style={styles.roomInfo}>
          Room: FlowShield
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

// Main component with connection management
export default function HomeScreen() {
  const [shouldConnect, setShouldConnect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAudio = async () => {
      try {
        await AudioSession.startAudioSession();
      } catch (error) {
        console.error('Error starting audio session:', error);
        setError('Failed to initialize audio session');
      }
    };

    initAudio();

    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  const connectToRoom = () => {
    if (!LIVEKIT_URL) {
      setError('LIVEKIT_URL is not configured');
      return;
    }
    
    if (!LIVEKIT_JWT) {
      setError('LIVEKIT_JWT is not configured. Please add your JWT token to the .env file or app.json extra config.');
      return;
    }

    setError(null);
    setShouldConnect(true);
  };

  const disconnect = () => {
    setShouldConnect(false);
  };

  if (shouldConnect && !error) {
    return <VoiceAssistant onDisconnect={disconnect} />;
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedText type="title">FlowShield Voice Assistant</ThemedText>
        <ThemedText style={styles.subtitle}>
          Tap to connect and start talking with the AI assistant
        </ThemedText>
      </ThemedView>

      {/* Error Display */}
      {error && (
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
        </ThemedView>
      )}

      {/* Connection Controls */}
      <ThemedView style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.connectButton]}
          onPress={connectToRoom}
        >
          <ThemedText style={styles.buttonText}>
            Connect to Assistant
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {/* Instructions */}
      <ThemedView style={styles.transcriptContainer}>
        <ThemedText type="subtitle" style={styles.transcriptTitle}>Instructions</ThemedText>
        <ThemedView style={styles.transcriptContent}>
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>
              1. Make sure you have added your LiveKit JWT token to the configuration
              {'\n\n'}
              2. Tap Connect to Assistant to join the voice chat
              {'\n\n'}
              3. Start speaking - the assistant will respond with voice and text
              {'\n\n'}
              4. Your conversation transcript will appear in real-time
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      {/* Status Bar */}
      <ThemedView style={styles.statusBar}>
        <View style={[styles.statusIndicator, styles.disconnectedIndicator]} />
        <ThemedText style={styles.statusText}>Disconnected</ThemedText>
        <ThemedText style={styles.roomInfo}>Ready to connect</ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffe6e6',
    padding: 15,
    margin: 15,
    borderRadius: 8,
    borderColor: '#ff0000',
    borderWidth: 1,
  },
  errorText: {
    color: '#cc0000',
    textAlign: 'center',
  },
  controlsContainer: {
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  participantInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    margin: 15,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#007AFF',
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
  },
  clearButton: {
    backgroundColor: '#8E8E93',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  transcriptContainer: {
    flex: 1,
    margin: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  transcriptTitle: {
    padding: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    textAlign: 'center',
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    padding: 15,
    minHeight: 200,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 150,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  participantName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  userParticipant: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  assistantParticipant: {
    color: '#666',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.6,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedIndicator: {
    backgroundColor: '#34C759',
  },
  disconnectedIndicator: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  roomInfo: {
    fontSize: 11,
    opacity: 0.6,
    marginLeft: 'auto',
  },
});
