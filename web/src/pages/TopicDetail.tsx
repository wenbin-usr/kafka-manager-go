import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions,
  Table,
  Spin,
  Alert,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Tooltip,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useCluster } from '../components/Layout';
import { getTopicDetail, getTopicConfigs, updateTopicConfigs } from '../api/client';
import type { TopicDetail as TopicDetailType, TopicConfigEntry } from '../types';

const SELECT_OPTIONS: Record<string, string[]> = {
  'cleanup.policy': ['delete', 'compact', 'compact,delete', 'delete,compact'],
  'compression.type': ['producer', 'uncompressed', 'gzip', 'snappy', 'lz4', 'zstd'],
};

const TopicDetail: React.FC = () => {
  const { t } = useTranslation();
  const { topic: topicName } = useParams<{ topic: string }>();
  const { selectedCluster } = useCluster();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<TopicDetailType | null>(null);
  const [configs, setConfigs] = useState<TopicConfigEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [error, setError] = useState('');
  const [configsError, setConfigsError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<Record<string, string>>();

  const decodedTopic = topicName ? decodeURIComponent(topicName) : '';

  const loadDetail = useCallback(async () => {
    if (!selectedCluster || !decodedTopic) return;
    setLoading(true);
    setError('');
    try {
      setDetail(await getTopicDetail(selectedCluster.id, decodedTopic));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedCluster, decodedTopic]);

  const loadConfigs = useCallback(async () => {
    if (!selectedCluster || !decodedTopic) return;
    setConfigsLoading(true);
    setConfigsError('');
    try {
      setConfigs(await getTopicConfigs(selectedCluster.id, decodedTopic));
    } catch (err: unknown) {
      setConfigs([]);
      setConfigsError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfigsLoading(false);
    }
  }, [selectedCluster, decodedTopic]);

  useEffect(() => {
    loadDetail();
    loadConfigs();
  }, [loadDetail, loadConfigs]);

  const editableConfigs = configs.filter((c) => c.editable);

  const openEditModal = () => {
    const initial: Record<string, string> = {};
    editableConfigs.forEach((c) => {
      initial[c.name] = c.value;
    });
    form.setFieldsValue(initial);
    setEditOpen(true);
  };

  const handleSaveConfigs = async () => {
    if (!selectedCluster || !decodedTopic) return;
    const values = await form.validateFields();
    const payload: Record<string, string> = {};
    editableConfigs.forEach((c) => {
      const v = values[c.name];
      if (v !== undefined && v !== c.value) {
        payload[c.name] = String(v).trim();
      }
    });
    if (Object.keys(payload).length === 0) {
      setEditOpen(false);
      return;
    }
    setSaving(true);
    try {
      await updateTopicConfigs(selectedCluster.id, decodedTopic, payload);
      message.success(t('topicDetail.configsUpdated'));
      setEditOpen(false);
      loadConfigs();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : t('topicDetail.configsUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />;
  if (error) return <Alert type="error" message={t('topicDetail.loadFailed')} description={error} />;
  if (!detail) return null;

  const partitionColumns = [
    { title: t('common.partition'), dataIndex: 'partition', key: 'partition', width: 100 },
    { title: t('topicDetail.leader'), dataIndex: 'leader', key: 'leader', width: 80 },
    {
      title: t('topicDetail.replicas'),
      dataIndex: 'replicas',
      key: 'replicas',
      width: 150,
      render: (replicas: number[]) => replicas.map((r) => <Tag key={r}>{r}</Tag>),
    },
    {
      title: t('topicDetail.isr'),
      dataIndex: 'isr',
      key: 'isr',
      width: 150,
      render: (isr: number[]) => isr.map((r) => <Tag key={r} color="green">{r}</Tag>),
    },
    {
      title: t('topicDetail.firstOffset'),
      dataIndex: 'firstOffset',
      key: 'firstOffset',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('topicDetail.lastOffset'),
      dataIndex: 'lastOffset',
      key: 'lastOffset',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('topicDetail.messages'),
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
  ];

  const configColumns = [
    {
      title: t('topicDetail.configName'),
      dataIndex: 'name',
      key: 'name',
      width: 220,
      ellipsis: true,
    },
    {
      title: t('topicDetail.configValue'),
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: t('topicDetail.configDefault'),
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      width: 140,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: t('topicDetail.configFlags'),
      key: 'status',
      width: 120,
      render: (_: unknown, row: TopicConfigEntry) => (
        <Space size={4} wrap>
          {row.sensitive && <Tag>{t('topicDetail.sensitive')}</Tag>}
          {row.readOnly && <Tag>{t('topicDetail.readOnly')}</Tag>}
          {row.editable && <Tag color="blue">{t('topicDetail.editable')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('topicDetail.configDoc'),
      dataIndex: 'documentation',
      key: 'documentation',
      ellipsis: true,
      render: (doc: string) =>
        doc ? (
          <Tooltip title={doc}>
            <span>{doc.length > 60 ? doc.substring(0, 60) + '...' : doc}</span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/topics')}>
          {t('topicDetail.backToTopics')}
        </Button>
      </div>

      <Descriptions title={t('topicDetail.topicTitle', { name: detail.name })} bordered column={3} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('common.partitions')}>{detail.partitionCount}</Descriptions.Item>
        <Descriptions.Item label={t('topics.replicationFactor')}>{detail.replicationFactor}</Descriptions.Item>
        <Descriptions.Item label={t('topicDetail.totalMessages')}>{detail.totalMessages.toLocaleString()}</Descriptions.Item>
      </Descriptions>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{t('topicDetail.configsTitle')}</h3>
        <Button
          type="primary"
          icon={<EditOutlined />}
          disabled={editableConfigs.length === 0}
          onClick={openEditModal}
        >
          {t('topicDetail.editConfigs')}
        </Button>
      </div>
      {configsError && (
        <Alert type="error" message={t('topicDetail.configsLoadFailed')} description={configsError} style={{ marginBottom: 16 }} />
      )}
      <Table
        columns={configColumns}
        dataSource={configs}
        rowKey="name"
        loading={configsLoading}
        pagination={{ pageSize: 15, showSizeChanger: true }}
        size="small"
        scroll={{ x: 900 }}
        locale={{ emptyText: t('topicDetail.noConfigs') }}
        style={{ marginBottom: 24 }}
      />

      <h3>{t('topicDetail.partitionsTitle')}</h3>
      <Table
        columns={partitionColumns}
        dataSource={detail.partitions}
        rowKey="partition"
        pagination={false}
        size="small"
        scroll={{ x: 800 }}
      />

      <Modal
        title={t('topicDetail.editConfigs')}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSaveConfigs}
        confirmLoading={saving}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {editableConfigs.map((c) => {
            const options = SELECT_OPTIONS[c.name];
            return (
              <Form.Item
                key={c.name}
                name={c.name}
                label={c.name}
                tooltip={c.documentation || undefined}
                rules={[{ required: true, message: t('topicDetail.configValue') }]}
              >
                {options ? (
                  <Select options={options.map((o) => ({ label: o, value: o }))} />
                ) : (
                  <Input />
                )}
              </Form.Item>
            );
          })}
        </Form>
      </Modal>
    </div>
  );
};

export default TopicDetail;
