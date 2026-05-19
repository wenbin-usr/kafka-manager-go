import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Descriptions, Spin, Alert, Button, Tag } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCluster } from '../components/Layout';
import { ResizableTable, type ResizableColumn } from '../components/ResizableTable';
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const decodedGroupId = groupId ? decodeURIComponent(groupId) : '';

  const loadDetail = useCallback(
    async (silent = false) => {
      if (!selectedCluster || !decodedGroupId) return;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');
      try {
        const data = await getConsumerGroupDetail(selectedCluster.id, decodedGroupId);
        setDetail(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        if (!silent) {
          setDetail(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedCluster, decodedGroupId],
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (loading && !detail) return <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />;
  if (error && !detail) return <Alert type="error" message={t('consumerGroupDetail.loadFailed')} description={error} />;
  if (!detail) return null;

  const memberColumns: ResizableColumn<(typeof detail.members)[number]>[] = [
    { title: t('consumerGroupDetail.memberId'), dataIndex: 'id', key: 'id', width: 180, ellipsis: true },
    { title: t('consumerGroupDetail.clientId'), dataIndex: 'clientId', key: 'clientId', width: 160, ellipsis: true },
    { title: t('consumerGroupDetail.host'), dataIndex: 'clientHost', key: 'clientHost', width: 140, ellipsis: true },
    {
      title: t('consumerGroupDetail.memberStrategy'),
      dataIndex: 'assignmentStrategies',
      key: 'assignmentStrategies',
      width: 160,
      ellipsis: true,
      render: (v: string | undefined) => v || '-',
    },
    {
      title: t('consumerGroupDetail.rebalanceType'),
      dataIndex: 'rebalanceType',
      key: 'rebalanceType',
      width: 140,
      render: (type: string | undefined) => rebalanceLabel(type, t),
    },
    {
      title: t('consumerGroupDetail.assignments'),
      dataIndex: 'assignments',
      key: 'assignments',
      width: 320,
      ellipsis: true,
    },
  ];

  const offsetColumns: ResizableColumn<(typeof detail.offsets)[number]>[] = [
    { title: t('consumerGroupDetail.topic'), dataIndex: 'topic', key: 'topic', width: 220, ellipsis: true },
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/consumer-groups')}>
          {t('consumerGroupDetail.back')}
        </Button>
        <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => loadDetail(true)}>
          {t('consumerGroupDetail.refresh')}
        </Button>
      </div>

      {error && (
        <Alert type="warning" message={error} style={{ marginBottom: 16 }} showIcon closable onClose={() => setError('')} />
      )}

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
          <ResizableTable
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
      <ResizableTable
        columns={offsetColumns}
        dataSource={detail.offsets}
        rowKey={(r) => `${r.topic}-${r.partition}`}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        loading={refreshing}
      />
    </div>
  );
};

export default ConsumerGroupDetail;
