import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Descriptions, Table, Spin, Alert, Button, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useCluster } from '../components/Layout';
import { getConsumerGroupDetail } from '../api/client';
import type { ConsumerGroupDetail as ConsumerGroupDetailType } from '../types';

const stateColors: Record<string, string> = {
  Stable: 'green',
  Empty: 'default',
  PreparingRebalance: 'orange',
  CompletingRebalance: 'orange',
  Dead: 'red',
};

const rebalanceLabel = (type: string | undefined, t: (key: string) => string) => {
  if (type === 'cooperative') return t('consumerGroupDetail.rebalanceCooperative');
  if (type === 'eager') return t('consumerGroupDetail.rebalanceEager');
  return '-';
};

const ConsumerGroupDetail: React.FC = () => {
  const { t } = useTranslation();
  const { group: groupId } = useParams<{ group: string }>();
  const { selectedCluster } = useCluster();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ConsumerGroupDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedCluster || !groupId) return;
    setLoading(true);
    setError('');
    getConsumerGroupDetail(selectedCluster.id, decodeURIComponent(groupId))
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedCluster, groupId]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />;
  if (error) return <Alert type="error" message={t('consumerGroupDetail.loadFailed')} description={error} />;
  if (!detail) return null;

  const memberColumns = [
    { title: t('consumerGroupDetail.memberId'), dataIndex: 'id', key: 'id' },
    { title: t('consumerGroupDetail.clientId'), dataIndex: 'clientId', key: 'clientId' },
    { title: t('consumerGroupDetail.host'), dataIndex: 'clientHost', key: 'clientHost' },
    {
      title: t('consumerGroupDetail.memberStrategy'),
      dataIndex: 'assignmentStrategies',
      key: 'assignmentStrategies',
      width: 160,
      render: (v: string | undefined) => v || '-',
    },
    {
      title: t('consumerGroupDetail.rebalanceType'),
      dataIndex: 'rebalanceType',
      key: 'rebalanceType',
      width: 140,
      render: (type: string | undefined) => rebalanceLabel(type, t),
    },
    { title: t('consumerGroupDetail.assignments'), dataIndex: 'assignments', key: 'assignments' },
  ];

  const offsetColumns = [
    { title: t('consumerGroupDetail.topic'), dataIndex: 'topic', key: 'topic' },
    { title: t('common.partition'), dataIndex: 'partition', key: 'partition', width: 100 },
    {
      title: t('consumerGroupDetail.offset'),
      dataIndex: 'offset',
      key: 'offset',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('consumerGroupDetail.logEnd'),
      dataIndex: 'logEnd',
      key: 'logEnd',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('consumerGroupDetail.lag'),
      dataIndex: 'lag',
      key: 'lag',
      width: 100,
      render: (lag: number) => {
        const color = lag > 1000 ? 'red' : lag > 0 ? 'orange' : 'green';
        return <Tag color={color}>{lag.toLocaleString()}</Tag>;
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/consumer-groups')}>
          {t('consumerGroupDetail.back')}
        </Button>
      </div>

      <Descriptions title={t('consumerGroupDetail.title', { groupId: detail.groupId })} bordered column={3} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('consumerGroups.state')}>
          <Tag color={stateColors[detail.state] || 'default'}>{detail.state}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label={t('consumerGroupDetail.assignmentStrategy')}>
          {detail.assignmentStrategies || '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('consumerGroupDetail.rebalanceType')}>
          {rebalanceLabel(detail.rebalanceType, t)}
        </Descriptions.Item>
        <Descriptions.Item label={t('consumerGroups.members')}>{detail.members.length}</Descriptions.Item>
        <Descriptions.Item label={t('consumerGroupDetail.totalLag')}>{detail.totalLag.toLocaleString()}</Descriptions.Item>
      </Descriptions>

      {detail.members.length > 0 && (
        <>
          <h3>{t('consumerGroupDetail.membersTitle')}</h3>
          <Table
            columns={memberColumns}
            dataSource={detail.members}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginBottom: 24 }}
          />
        </>
      )}

      <h3>{t('consumerGroupDetail.offsetsLag')}</h3>
      <Table
        columns={offsetColumns}
        dataSource={detail.offsets}
        rowKey={(r) => `${r.topic}-${r.partition}`}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
      />
    </div>
  );
};

export default ConsumerGroupDetail;
