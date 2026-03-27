import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, FlatList, Alert,
  TextInput, ActivityIndicator, Modal
} from 'react-native';
import { getToken, removeToken } from '../../services/TokenManager';
import { API_BASE_URL } from '../../config/server';

const BASE = `${API_BASE_URL}/admin`;

// ─── API HELPER ───────────────────────────────────────────
const apiCall = async (method, endpoint, body = null) => {
  const token = await getToken();
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${endpoint}`, options);
  return res.json();
};

// ─── MAIN COMPONENT ───────────────────────────────────────
export default function AdminDashboardScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);

  // Notification modal
  const [notifModal, setNotifModal] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState('all');

  // Suspend modal
  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (activeTab === 'dashboard') loadStats();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'complaints') loadComplaints();
  }, [activeTab]);

  // ─── LOADERS ──────────────────────────────────────────
  const loadStats = async () => {
    setLoading(true);
    const res = await apiCall('GET', '/dashboard');
    if (res.success) setStats(res.data);
    setLoading(false);
  };

  const loadUsers = async () => {
    setLoading(true);
    const res = await apiCall('GET', '/users');
    if (res.success) setUsers(res.data);
    setLoading(false);
  };

  const loadComplaints = async () => {
    setLoading(true);
    const res = await apiCall('GET', '/complaints');
    if (res.success) setComplaints(res.data);
    setLoading(false);
  };

  // ─── ACTIONS ──────────────────────────────────────────
  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      Alert.alert('Error', 'Please enter a reason');
      return;
    }
    const res = await apiCall('PUT', `/users/${selectedUser._id}/suspend`, {
      reason: suspendReason
    });
    Alert.alert(res.success ? 'Done' : 'Error', res.message);
    setSuspendModal(false);
    setSuspendReason('');
    loadUsers();
  };

  const handleReactivate = (user) => {
    Alert.alert(
      'Reactivate User',
      `Reactivate ${user.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            const res = await apiCall('PUT', `/users/${user._id}/reactivate`);
            Alert.alert(res.success ? 'Done' : 'Error', res.message);
            loadUsers();
          }
        }
      ]
    );
  };

  const handleResolveComplaint = (complaint) => {
    Alert.alert(
      'Resolve Complaint',
      'Mark this complaint as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            const res = await apiCall(
              'PUT',
              `/complaints/${complaint._id}/resolve`,
              { adminNote: 'Resolved by admin' }
            );
            Alert.alert(res.success ? 'Done' : 'Error', res.message);
            loadComplaints();
          }
        }
      ]
    );
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      Alert.alert('Error', 'Please fill title and message');
      return;
    }
    const res = await apiCall('POST', '/notifications/send', {
      title: notifTitle,
      message: notifMessage,
      target: notifTarget
    });
    Alert.alert(res.success ? 'Sent!' : 'Error', res.message);
    setNotifModal(false);
    setNotifTitle('');
    setNotifMessage('');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await removeToken();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }]
            });
          }
        }
      ]
    );
  };

  // ─── RENDER TABS ──────────────────────────────────────
  const renderDashboard = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Overview</Text>
      {loading ? <ActivityIndicator color="#B76E22" style={{ marginTop: 40 }} /> : (
        <View style={styles.statsGrid}>
          <StatCard label="Customers" value={stats?.totalCustomers ?? 0} color="#4CAF50" icon="👤" />
          <StatCard label="Barbers" value={stats?.totalBarbers ?? 0} color="#2196F3" icon="✂️" />
          <StatCard label="Suspended" value={stats?.suspendedUsers ?? 0} color="#F44336" icon="🚫" />
          <StatCard label="Complaints" value={stats?.pendingComplaints ?? 0} color="#FF9800" icon="📋" />
        </View>
      )}

      <TouchableOpacity
        style={styles.notifButton}
        onPress={() => setNotifModal(true)}
      >
        <Text style={styles.notifButtonText}>🔔 Send Notification</Text>
      </TouchableOpacity>

      <View style={styles.quickLinks}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.quickBtn} onPress={() => setActiveTab('users')}>
          <Text style={styles.quickBtnText}>👥 Manage Users →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => setActiveTab('complaints')}>
          <Text style={styles.quickBtnText}>📋 View Complaints →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderUsers = () => (
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>All Users</Text>
      {loading
        ? <ActivityIndicator color="#B76E22" style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.avatarText}>
                      {item.username?.[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.userName}>{item.username}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[
                        styles.badge,
                        { backgroundColor: item.user_type === 'barber' ? '#2196F3' : '#4CAF50' }
                      ]}>
                        <Text style={styles.badgeText}>
                          {item.user_type === 'barber' ? '✂️ Barber' : '👤 Customer'}
                        </Text>
                      </View>
                      <View style={[
                        styles.badge,
                        { backgroundColor: item.is_active ? '#E8F5E9' : '#FFEBEE' }
                      ]}>
                        <Text style={[
                          styles.badgeText,
                          { color: item.is_active ? '#2E7D32' : '#C62828' }
                        ]}>
                          {item.is_active ? 'Active' : 'Suspended'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.userActions}>
                  {item.is_active ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}
                      onPress={() => {
                        setSelectedUser(item);
                        setSuspendModal(true);
                      }}
                    >
                      <Text style={[styles.actionBtnText, { color: '#C62828' }]}>
                        Suspend
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]}
                      onPress={() => handleReactivate(item)}
                    >
                      <Text style={[styles.actionBtnText, { color: '#2E7D32' }]}>
                        Reactivate
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />
        )}
    </View>
  );

  const renderComplaints = () => (
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>Complaints</Text>
      {loading
        ? <ActivityIndicator color="#B76E22" style={{ marginTop: 40 }} />
        : complaints.length === 0
          ? <Text style={styles.emptyText}>No complaints yet 🎉</Text>
          : (
            <FlatList
              data={complaints}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.complaintCard}>
                  <View style={styles.complaintHeader}>
                    <Text style={styles.complaintUser}>
                      {item.userId?.username || 'Unknown'}
                    </Text>
                    <View style={[
                      styles.badge,
                      { backgroundColor: item.status === 'pending' ? '#FFF3E0' : '#E8F5E9' }
                    ]}>
                      <Text style={[
                        styles.badgeText,
                        { color: item.status === 'pending' ? '#E65100' : '#2E7D32' }
                      ]}>
                        {item.status === 'pending' ? '⏳ Pending' : '✅ Resolved'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.complaintSubject}>{item.subject}</Text>
                  <Text style={styles.complaintMessage}>{item.message}</Text>
                  {item.status === 'pending' && (
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => handleResolveComplaint(item)}
                    >
                      <Text style={styles.resolveBtnText}>Mark as Resolved</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}
    </View>
  );

  // ─── MAIN RENDER ──────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>⚙️ Admin Panel</Text>
          <Text style={styles.headerSubtitle}>Book-A-Cut Management</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {['dashboard', 'users', 'complaints'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'dashboard' ? '🏠 Home' :
               tab === 'users' ? '👥 Users' : '📋 Cases'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'complaints' && renderComplaints()}
      </View>

      {/* Send Notification Modal */}
      <Modal visible={notifModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🔔 Send Notification</Text>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Notification title"
              value={notifTitle}
              onChangeText={setNotifTitle}
            />

            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Your message..."
              value={notifMessage}
              onChangeText={setNotifMessage}
              multiline
            />

            <Text style={styles.inputLabel}>Send To</Text>
            <View style={styles.targetRow}>
              {['all', 'customer', 'barber'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.targetBtn,
                    notifTarget === t && styles.targetBtnActive
                  ]}
                  onPress={() => setNotifTarget(t)}
                >
                  <Text style={[
                    styles.targetBtnText,
                    notifTarget === t && styles.targetBtnTextActive
                  ]}>
                    {t === 'all' ? 'All' : t === 'customer' ? 'Customers' : 'Barbers'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#eee' }]}
                onPress={() => setNotifModal(false)}
              >
                <Text style={{ color: '#333' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#B76E22' }]}
                onPress={handleSendNotification}
              >
                <Text style={{ color: '#fff' }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Suspend Modal */}
      <Modal visible={suspendModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              🚫 Suspend {selectedUser?.username}
            </Text>
            <Text style={styles.inputLabel}>Reason</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Enter reason for suspension..."
              value={suspendReason}
              onChangeText={setSuspendReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#eee' }]}
                onPress={() => setSuspendModal(false)}
              >
                <Text style={{ color: '#333' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#F44336' }]}
                onPress={handleSuspend}
              >
                <Text style={{ color: '#fff' }}>Suspend</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── STAT CARD COMPONENT ──────────────────────────────────
const StatCard = ({ label, value, color, icon }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── STYLES ───────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },

  header: {
    backgroundColor: '#B76E22',
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: '#FFE0B2', marginTop: 2 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#B76E22' },
  tabText: { fontSize: 13, color: '#999' },
  activeTabText: { color: '#B76E22', fontWeight: 'bold' },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 2
  },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: 26, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },

  notifButton: {
    backgroundColor: '#B76E22',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20
  },
  notifButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  quickLinks: { marginBottom: 20 },
  quickBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 1
  },
  quickBtnText: { color: '#B76E22', fontWeight: '600' },

  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#B76E22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  userName: { fontWeight: 'bold', fontSize: 15, color: '#333' },
  userEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  badgeRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  userActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { fontWeight: '600', fontSize: 13 },

  complaintCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  complaintUser: { fontWeight: 'bold', color: '#333' },
  complaintSubject: { fontWeight: '600', color: '#B76E22', marginBottom: 4 },
  complaintMessage: { fontSize: 13, color: '#666', marginBottom: 10 },
  resolveBtn: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center'
  },
  resolveBtnText: { color: '#2E7D32', fontWeight: '600' },

  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 60, fontSize: 15 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  inputLabel: { fontSize: 13, color: '#666', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    fontSize: 14,
    backgroundColor: '#fafafa'
  },
  targetRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  targetBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center'
  },
  targetBtnActive: { backgroundColor: '#B76E22', borderColor: '#B76E22' },
  targetBtnText: { color: '#666', fontWeight: '600' },
  targetBtnTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)'
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13
  }
});
