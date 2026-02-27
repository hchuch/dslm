import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '../../components/themed-text';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/auth-context';
import { useDialog } from '../../hooks/use-dialog';

import { getApiBaseUrlSync } from '../../services/api-config';

interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: string;
  currentLocation: string;
  createdAt: string;
}

type UserRole = 'admin' | 'astronaut' | 'mission-specialist' | 'ground-crew' | 'loader';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'astronaut', label: 'Astronaut' },
  { value: 'mission-specialist', label: 'Mission Specialist' },
  { value: 'ground-crew', label: 'Ground Crew' },
  { value: 'loader', label: 'Cargo Loader' },
];

const LOCATIONS = ['Earth', 'Gateway', 'Lunar-Surface', 'DSLM', 'In-Transit'];

export default function AdminScreen() {
  const { getToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'astronaut' as UserRole,
    currentLocation: 'Earth',
  });
  const [isSaving, setIsSaving] = useState(false);
  const { showDialog } = useDialog();

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();

      const response = await fetch(`${getApiBaseUrlSync()}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      name: '',
      role: 'astronaut',
      currentLocation: 'Earth',
    });
    setModalVisible(true);
  };

  const openEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role as UserRole,
      currentLocation: user.currentLocation,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showDialog('Error', 'Name is required');
      return;
    }

    if (!editingUser && (!formData.username.trim() || !formData.password)) {
      showDialog('Error', 'Username and password are required for new users');
      return;
    }

    try {
      setIsSaving(true);
      const token = await getToken();

      if (editingUser) {
        const updateData: any = {
          name: formData.name,
          role: formData.role,
          currentLocation: formData.currentLocation,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }

        const response = await fetch(`${getApiBaseUrlSync()}/api/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update user');
        }
      } else {
        const response = await fetch(`${getApiBaseUrlSync()}/api/users`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create user');
        }
      }

      setModalVisible(false);
      fetchUsers();
    } catch (err: any) {
      showDialog('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (user: UserAccount) => {
    if (user.id === currentUser?.id) {
      showDialog('Error', 'You cannot delete your own account');
      return;
    }

    showDialog(
      'Delete User',
      `Are you sure you want to delete "${user.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const response = await fetch(`${getApiBaseUrlSync()}/api/users/${user.id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete user');
              }

              fetchUsers();
            } catch (err: any) {
              showDialog('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#FF453A';
      case 'astronaut':
        return Colors.blue;
      case 'mission-specialist':
        return '#30D158';
      case 'ground-crew':
        return '#FF9F0A';
      case 'loader':
        return '#BF5AF2';
      default:
        return Colors.textSecondary;
    }
  };

  const renderUser = ({ item }: { item: UserAccount }) => (
    <View style={styles.userCard}>
      <View style={styles.userTop}>
        <View style={styles.userInfo}>
          <ThemedText style={styles.userName}>{item.name}</ThemedText>
          <ThemedText style={styles.username}>@{item.username}</ThemedText>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '20' }]}>
          <ThemedText style={[styles.roleText, { color: getRoleColor(item.role) }]}>
            {item.role.replace('-', ' ')}
          </ThemedText>
        </View>
      </View>
      <View style={styles.userBottom}>
        <ThemedText style={styles.location}>{item.currentLocation}</ThemedText>
        <View style={styles.userActions}>
          <Pressable style={styles.editButton} onPress={() => openEditModal(item)}>
            <ThemedText style={styles.editButtonText}>Edit</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.deleteButton, item.id === currentUser?.id && styles.buttonDisabled]}
            onPress={() => handleDelete(item)}
            disabled={item.id === currentUser?.id}
          >
            <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.blue} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable style={styles.retryButton} onPress={fetchUsers}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.title}>User Management</ThemedText>
          <ThemedText style={styles.subtitle}>{users.length} accounts</ThemedText>
        </View>
        <Pressable style={styles.addButton} onPress={openCreateModal}>
          <ThemedText style={styles.addButtonText}>+ Add User</ThemedText>
        </Pressable>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <ThemedText style={styles.emptyText}>No users found</ThemedText>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              {editingUser ? 'Edit User' : 'Create User'}
            </ThemedText>

            {!editingUser && (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>USERNAME</ThemedText>
                <TextInput
                  style={styles.input}
                  value={formData.username}
                  onChangeText={(text) => setFormData({ ...formData, username: text })}
                  placeholder="Enter username"
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>NAME</ThemedText>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter full name"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>
                {editingUser ? 'NEW PASSWORD (leave blank to keep current)' : 'PASSWORD'}
              </ThemedText>
              <TextInput
                style={styles.input}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
                placeholderTextColor="#666"
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>ROLE</ThemedText>
              <View style={styles.roleSelector}>
                {ROLES.map((role) => (
                  <Pressable
                    key={role.value}
                    style={[
                      styles.roleOption,
                      formData.role === role.value && styles.roleOptionSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, role: role.value })}
                  >
                    <ThemedText
                      style={[
                        styles.roleOptionText,
                        formData.role === role.value && styles.roleOptionTextSelected,
                      ]}
                    >
                      {role.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>LOCATION</ThemedText>
              <View style={styles.locationSelector}>
                {LOCATIONS.map((loc) => (
                  <Pressable
                    key={loc}
                    style={[
                      styles.locationOption,
                      formData.currentLocation === loc && styles.locationOptionSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, currentLocation: loc })}
                  >
                    <ThemedText
                      style={[
                        styles.locationOptionText,
                        formData.currentLocation === loc && styles.locationOptionTextSelected,
                      ]}
                    >
                      {loc}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                disabled={isSaving}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>
                    {editingUser ? 'Update' : 'Create'}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: Colors.blue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  userTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  username: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  userBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: Colors.blue + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: Colors.blue,
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#FF453A15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#FF453A',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleOptionSelected: {
    backgroundColor: Colors.blue,
    borderColor: Colors.blue,
  },
  roleOptionText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  roleOptionTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  locationSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationOption: {
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationOptionSelected: {
    backgroundColor: '#30D158',
    borderColor: '#30D158',
  },
  locationOptionText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  locationOptionTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.blue,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '600',
  },
});
