import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Descriptions, Table, Spin, Alert, Button, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useCluster } from '../components/Layout';
import { getTopicDetail } from '../api/client';
import type { TopicDetail as TopicDetailType } from '../types';

const TopicDetail: React.FC = () => {
  const { t } = useTranslation();
  const { topic: topicName } = useParams<{ topic: string }>();
  const { selectedCluster } = useCluster();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<TopicDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedCluster || !topicName) return;
    setLoading(true);
    setError('');
    getTopicDetail(selectedCluster.id, decodeURIComponent(topicName))
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedCluster, topicName]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />;
  if (error) return <Alert type="error" message={t('topicDetail.loadFailed')} description={error} />;
  if (!detail) return null;

  const columns = [
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

      <h3>{t('topicDetail.partitionsTitle')}</h3>
      <Table
        columns={columns}
        dataSource={detail.partitions}
        rowKey="partition"
        pagination={false}
        size="small"
        scroll={{ x: 800 }}
      />
    </div>
  );
};

export default TopicDetail;
