import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from '../../src/i18n';
import { useAuth } from '../../src/context/AuthContext';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  isMe: boolean;
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ bookingId: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      senderId: 'other-user',
      senderName: 'Dave Vance',
      body: 'Hi Sarah, I see your booking. I am on my way with the replacement breaker panel and will arrive in 20 minutes.',
      createdAt: '10:14 AM',
      isMe: false,
    },
    {
      id: 'm2',
      senderId: user?.id || 'me',
      senderName: 'You',
      body: 'Great, thank you! The side gate is unlocked and the main breaker box is located on the north wall.',
      createdAt: '10:16 AM',
      isMe: true,
    },
  ]);

  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: user?.id || 'me',
      senderName: 'You',
      body: inputText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.isMe ? styles.myBubble : styles.theirBubble,
            ]}
          >
            <Text style={[styles.senderName, item.isMe && styles.mySenderName]}>
              {item.senderName}
            </Text>
            <Text style={[styles.messageText, item.isMe && styles.myMessageText]}>
              {item.body}
            </Text>
            <Text style={[styles.messageTime, item.isMe && styles.myMessageTime]}>
              {item.createdAt}
            </Text>
          </View>
        )}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder={t('typeMessage')}
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>{t('send')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 14,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0284c7',
  },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
  },
  mySenderName: {
    color: '#e0f2fe',
  },
  messageText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 19,
  },
  myMessageText: {
    color: '#ffffff',
  },
  messageTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: '#bae6fd',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  sendButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
