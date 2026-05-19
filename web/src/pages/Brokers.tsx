import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Tag, Spin, Alert, Button, Space } from 'antd';
import { ResizableTable, type ResizableColumn } from '../components/ResizableTable';
import { ReloadOutlined, CrownOutlined } from '@ant-design/icons';
import { useCluster } from '../components/Layout';
import { listBrokers } from '../api/client';
import type { BrokerInfo, BrokerTopicAssignment } from '../types';

const Brokers: React.FC = () => {
  const { t } = useTranslation();
  const { selectedCluster } = useCluster();
  const navigate = useNavigate();
  const [brokers, setBrokers] = useState<BrokerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clusterId, setClusterId] = useState('');

  const loadBrokers = useCallback(async () => {
    if (!selectedCluster) return;
    setLoading(true);
    setError('');
    try {
      const data = await listBrokers(selectedCluster.id);
      setBrokers(data);
      setClusterId(data[0]?.clusterId ?? '');
    } catch (err: unknown) {
      setBrokers([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedCluster]);

  useEffect(() => {
    loadBrokers();
  }, [loadBrokers]);

  const columns: ResizableColumn<BrokerInfo>[] = [
    {
      title: t('brokers.brokerId'),
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: number, record: BrokerInfo) => (
        <Space size={4}>
          <span>{id}</span>
          {record.isController && (
            <Tag color="gold" icon={<CrownOutlined />}>
              {t('brokers.controller')}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('brokers.address'),
      dataIndex: 'address',
      key: 'address',
      width: 220,
    },
    {
      title: t('brokers.rack'),
      dataIndex: 'rack',
      key: 'rack',
      width: 120,
      render: (rack: string) => rack || '-',
    },
    {
      title: t('brokers.leaderPartitions'),
      dataIndex: 'leaderPartitions',
      key: 'leaderPartitions',
      width: 130,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('brokers.replicaPartitions'),
      dataIndex: 'replicaPartitions',
      key: 'replicaPartitions',
      width: 130,
      render: (v: number) => v.toLocaleString(),
    },
  ];

  const assignmentColumns: ResizableColumn<BrokerTopicAssignment>[] = [
    {
      title: t('consumerGroupDetail.topic'),
      dataIndex: 'topic',
      key: 'topic',
      width: 260,
      render: (topic: string) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/topics/${encodeURIComponent(topic)}`)}>
          {topic}
        </Button>
      ),
    },
    {
      title: t('common.partition'),
      dataIndex: 'partition',
      key: 'partition',
      width: 100,
    },
    {
      title: t('brokers.role'),
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={role === 'leader' ? 'blue' : 'default'}>
          {role === 'leader' ? t('brokers.roleLeader') : t('brokers.roleReplica')}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('brokers.title')}</h2>
          {clusterId && (
            <div style={{ color: 'rgba(0,0,0,0.45)', marginTop: 4, fontSize: 13 }}>
              {t('brokers.clusterId')}: {clusterId}
            </div>
          )}
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadBrokers} loading={loading}>
          {t('common.reload')}
        </Button>
      </div>

      {error && <Alert type="error" message={t('brokers.loadFailed')} description={error} style={{ marginBottom: 16 }} />}

      <ResizableTable
        columns={columns}
        dataSource={brokers}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: t('brokers.noBrokers') }}
        expandable={{
          expandedRowRender: (record: BrokerInfo) => (
            <ResizableTable<BrokerTopicAssignment>
              columns={assignmentColumns}
              dataSource={record.assignments}
              rowKey={(row) => `${row.topic}-${row.partition}-${row.role}`}
              pagination={{ pageSize: 10, size: 'small' }}
              size="small"
            />
          ),
          rowExpandable: (record) => record.assignments.length > 0,
        }}
      />
    </div>
  );
};

export default Brokers;
