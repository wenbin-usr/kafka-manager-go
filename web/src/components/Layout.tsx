import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Layout as AntLayout,
  Menu,
  Select,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Typography,
  Segmented,
  theme,
} from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  MessageOutlined,
  PlusOutlined,
  DeleteOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import type { ClusterConfig } from '../types';
import { listClusters, addCluster, removeCluster } from '../api/client';
import { useAppSettings } from '../context/AppSettings';
import AppLogo from './AppLogo';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;

interface ClusterContextType {
  clusters: ClusterConfig[];
  selectedCluster: ClusterConfig | null;
  setSelectedClusterId: (id: string | null) => void;
  refreshClusters: () => Promise<void>;
}

export const ClusterContext = createContext<ClusterContextType>({
  clusters: [],
  selectedCluster: null,
  setSelectedClusterId: () => {},
  refreshClusters: async () => {},
});

export const useCluster = () => useContext(ClusterContext);

const Layout: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { locale, themeMode, setLocale, setThemeMode } = useAppSettings();
  const [clusters, setClusters] = useState<ClusterConfig[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) || null;

  const refreshClusters = useCallback(async () => {
    try {
      const data = await listClusters();
      setClusters(data);
      if (data.length === 1 && !selectedClusterId) {
        setSelectedClusterId(data[0].id);
      }
      if (selectedClusterId && !data.find((c) => c.id === selectedClusterId)) {
        setSelectedClusterId(data.length > 0 ? data[0].id : null);
      }
    } catch {
      message.error(t('layout.loadClustersFailed'));
    }
  }, [selectedClusterId, t]);

  useEffect(() => {
    refreshClusters();
  }, []);

  const handleAddCluster = async (values: { name: string; brokers: string }) => {
    try {
      const cluster = await addCluster(values.name, values.brokers);
      setSelectedClusterId(cluster.id);
      setAddModalOpen(false);
      form.resetFields();
      await refreshClusters();
      message.success(t('layout.clusterAdded'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('layout.addClusterFailed');
      message.error(msg);
    }
  };

  const handleRemoveCluster = async () => {
    if (!selectedClusterId) return;
    Modal.confirm({
      title: t('layout.removeCluster'),
      content: t('layout.removeClusterConfirm', { name: selectedCluster?.name }),
      onOk: async () => {
        try {
          await removeCluster(selectedClusterId);
          setSelectedClusterId(null);
          await refreshClusters();
          message.success(t('layout.clusterRemoved'));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : t('layout.removeClusterFailed');
          message.error(msg);
        }
      },
    });
  };

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: t('layout.dashboard') },
    { key: '/topics', icon: <UnorderedListOutlined />, label: t('layout.topics') },
    { key: '/consumer-groups', icon: <TeamOutlined />, label: t('layout.consumerGroups') },
    { key: '/messages', icon: <MessageOutlined />, label: t('layout.messages') },
  ];

  const currentPath = '/' + (location.pathname.split('/')[1] || 'dashboard');
  const siderTheme = themeMode === 'dark' ? 'dark' : 'light';
  const titleColor = siderTheme === 'dark' ? '#fff' : token.colorText;

  return (
    <ClusterContext.Provider value={{ clusters, selectedCluster, setSelectedClusterId, refreshClusters }}>
      <AntLayout style={{ minHeight: '100vh' }}>
        <Sider width={220} theme={siderTheme}>
          <div
            style={{
              padding: '16px',
              borderBottom: `1px solid ${siderTheme === 'dark' ? 'rgba(255,255,255,0.1)' : token.colorBorderSecondary}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              justifyContent: 'center',
            }}
          >
            <AppLogo size={36} />
            <Title level={4} style={{ color: titleColor, margin: 0 }}>
              {t('layout.appTitle')}
            </Title>
          </div>
          <Menu
            theme={siderTheme}
            mode="inline"
            selectedKeys={[currentPath]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ marginTop: 8 }}
          />
        </Sider>
        <AntLayout>
          <Header
            style={{
              background: token.colorBgContainer,
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: token.boxShadowTertiary,
            }}
          >
            <Space>
              <Select
                style={{ width: 250 }}
                placeholder={t('layout.selectCluster')}
                value={selectedClusterId || undefined}
                onChange={setSelectedClusterId}
                options={clusters.map((c) => ({ label: `${c.name} (${c.brokers})`, value: c.id }))}
                notFoundContent={t('layout.noClusters')}
              />
              <Button icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)} />
              <Button
                icon={<DeleteOutlined />}
                danger
                disabled={!selectedClusterId}
                onClick={handleRemoveCluster}
              />
            </Space>
            <Space size="middle">
              <Segmented
                value={locale}
                onChange={(v) => setLocale(v as 'en' | 'zh')}
                options={[
                  { label: '中文', value: 'zh' },
                  { label: 'EN', value: 'en' },
                ]}
              />
              <Segmented
                value={themeMode}
                onChange={(v) => setThemeMode(v as 'light' | 'dark')}
                options={[
                  { value: 'light', icon: <SunOutlined />, label: t('layout.themeLight') },
                  { value: 'dark', icon: <MoonOutlined />, label: t('layout.themeDark') },
                ]}
              />
            </Space>
          </Header>
          <Content
            style={{
              margin: 24,
              padding: 24,
              background: token.colorBgContainer,
              borderRadius: token.borderRadiusLG,
              minHeight: 280,
            }}
          >
            {selectedCluster ? (
              <Outlet />
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: token.colorTextSecondary }}>
                <p style={{ fontSize: 18 }}>{t('layout.noClusterSelected')}</p>
                <p>{t('layout.noClusterHint')}</p>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
                  {t('layout.addCluster')}
                </Button>
              </div>
            )}
          </Content>
        </AntLayout>
      </AntLayout>

      <Modal
        title={t('layout.addKafkaCluster')}
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleAddCluster}>
          <Form.Item
            name="name"
            label={t('layout.clusterName')}
            rules={[{ required: true, message: t('layout.clusterNameRequired') }]}
          >
            <Input placeholder={t('layout.clusterNamePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="brokers"
            label={t('layout.brokerAddresses')}
            rules={[{ required: true, message: t('layout.brokersRequired') }]}
          >
            <Input placeholder={t('layout.brokersPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </ClusterContext.Provider>
  );
};

export default Layout;