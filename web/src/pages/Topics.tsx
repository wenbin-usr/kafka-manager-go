import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Form, InputNumber, Space, message, Popconfirm, Tag } from 'antd';
import { ResizableTable, type ResizableColumn } from '../components/ResizableTable';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCluster } from '../components/Layout';
import { listTopics, createTopic, deleteTopic } from '../api/client';
import type { TopicInfo } from '../types';

const Topics: React.FC = () => {
  const { t } = useTranslation();
  const { selectedCluster } = useCluster();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchTopics = async () => {
    if (!selectedCluster) return;
    setLoading(true);
    try {
      const data = await listTopics(selectedCluster.id);
      setTopics(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('topics.loadFailed');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, [selectedCluster]);

  const handleCreate = async (values: { name: string; partitionCount: number; replicationFactor: number }) => {
    if (!selectedCluster) return;
    try {
      await createTopic(selectedCluster.id, values.name, values.partitionCount, values.replicationFactor);
      message.success(t('topics.created'));
      setCreateModalOpen(false);
      form.resetFields();
      fetchTopics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('topics.createFailed');
      message.error(msg);
    }
  };

  const handleDelete = async (topic: string) => {
    if (!selectedCluster) return;
    try {
      await deleteTopic(selectedCluster.id, topic);
      message.success(t('topics.deleted'));
      fetchTopics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('topics.deleteFailed');
      message.error(msg);
    }
  };

  const filtered = topics.filter((topic) => topic.name.toLowerCase().includes(search.toLowerCase()));

  const columns: ResizableColumn<TopicInfo>[] = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      width: 280,
      render: (name: string) => (
        <a onClick={() => navigate(`/topics/${encodeURIComponent(name)}`)}>{name}</a>
      ),
    },
    {
      title: t('common.partitions'),
      dataIndex: 'partitionCount',
      key: 'partitionCount',
      width: 120,
    },
    {
      title: t('topics.replicationFactor'),
      dataIndex: 'replicationFactor',
      key: 'replicationFactor',
      width: 150,
      render: (rf: number) => <Tag>{rf}</Tag>,
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 100,
      render: (_: unknown, record: TopicInfo) => (
        <Popconfirm
          title={t('topics.deleteConfirm')}
          description={t('topics.deleteDescription', { name: record.name })}
          onConfirm={() => handleDelete(record.name)}
        >
          <Button danger size="small">
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t('topics.title')}</h2>
        <Space>
          <Input.Search
            placeholder={t('topics.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchTopics} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            {t('topics.createTopic')}
          </Button>
        </Space>
      </div>

      <ResizableTable
        columns={columns}
        dataSource={filtered}
        rowKey="name"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      <Modal
        title={t('topics.createTopic')}
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ partitionCount: 3, replicationFactor: 1 }}>
          <Form.Item name="name" label={t('topics.topicName')} rules={[{ required: true }]}>
            <Input placeholder="my-topic" />
          </Form.Item>
          <Form.Item name="partitionCount" label={t('common.partitions')} rules={[{ required: true }]}>
            <InputNumber min={1} max={256} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="replicationFactor" label={t('topics.replicationFactor')} rules={[{ required: true }]}>
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Topics;
