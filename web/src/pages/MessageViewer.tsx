import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  InputNumber,
  Button,
  Space,
  Tag,
  Spin,
  Alert,
  message,
  Input,
  theme,
  Typography,
  Modal,
  Descriptions,
  Form,
  Dropdown,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  CopyOutlined,
  SendOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { exportMessages, type MessageExportFormat } from '../utils/messageExport';
import { useCluster } from '../components/Layout';
import { ResizableTable, type ResizableColumn } from '../components/ResizableTable';
import { listTopics, readMessages, produceMessage } from '../api/client';
import type { TopicInfo, MessageRecord, MessageHeader } from '../types';

const { Text } = Typography;

type TimestampSort = 'asc' | 'desc' | null;

const emptyDisplay = (value: string) => value || '-';

const MessageViewer: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { selectedCluster } = useCluster();
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>();
  const [partition, setPartition] = useState<number | undefined>();
  const [startOffset, setStartOffset] = useState<number | undefined>();
  const [limit, setLimit] = useState(20);
  const [valueFilter, setValueFilter] = useState('');
  const [timestampSort, setTimestampSort] = useState<TimestampSort>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [detailMessage, setDetailMessage] = useState<MessageRecord | null>(null);
  const [produceOpen, setProduceOpen] = useState(false);
  const [producing, setProducing] = useState(false);
  const [produceForm] = Form.useForm<{
    key?: string;
    value: string;
    partition?: number;
    headers?: { key: string; value: string }[];
  }>();

  useEffect(() => {
    if (!selectedCluster) return;
    listTopics(selectedCluster.id)
      .then(setTopics)
      .catch(() => message.error(t('messageViewer.loadTopicsFailed')));
  }, [selectedCluster, t]);

  const handleSearch = async () => {
    if (!selectedCluster || !selectedTopic) return;
    setLoading(true);
    setError('');
    setSearched(true);
    setTimestampSort(null);
    setDetailMessage(null);
    try {
      const data = await readMessages(selectedCluster.id, selectedTopic, {
        partition,
        startOffset: startOffset !== undefined ? startOffset : undefined,
        limit,
        valueFilter: valueFilter || undefined,
      });
      setMessages(data);
    } catch (err: unknown) {
      setMessages([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const messageList = Array.isArray(messages) ? messages : [];

  const sortedMessages = useMemo(() => {
    if (!timestampSort) return messageList;
    return [...messageList].sort((a, b) => {
      const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return timestampSort === 'asc' ? diff : -diff;
    });
  }, [messageList, timestampSort]);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        message.success(t('messageViewer.copied'));
      } catch {
        message.error(t('messageViewer.copyFailed'));
      }
    },
    [t],
  );

  const formatHeadersForCopy = useCallback((headers: MessageHeader[]) => {
    if (!headers.length) return '';
    return headers
      .map((h) => {
        const suffix = h.encoding === 'base64' ? ' (base64)' : '';
        return `${h.key}: ${h.value}${suffix}`;
      })
      .join('\n');
  }, []);

  const formatMessageForCopy = useCallback(
    (record: MessageRecord) => {
      const lines = [
        `partition: ${record.partition}`,
        `offset: ${record.offset}`,
        `key: ${record.key}`,
        `timestamp: ${new Date(record.timestamp).toISOString()}`,
      ];
      if (record.headers?.length) {
        lines.push('headers:', formatHeadersForCopy(record.headers));
      }
      lines.push('value:', record.value);
      return lines.join('\n');
    },
    [formatHeadersForCopy],
  );

  const openProduceModal = () => {
    produceForm.setFieldsValue({ key: '', value: '', partition: undefined, headers: [] });
    setProduceOpen(true);
  };

  const handleExport = (format: MessageExportFormat) => {
    if (!selectedTopic || sortedMessages.length === 0) {
      message.warning(t('messageViewer.exportEmpty'));
      return;
    }
    exportMessages(sortedMessages, selectedTopic, format);
    message.success(t('messageViewer.exportSuccess', { count: sortedMessages.length }));
  };

  const handleProduce = async () => {
    if (!selectedCluster || !selectedTopic) return;
    const values = await produceForm.validateFields();
    const headers = (values.headers ?? [])
      .filter((h: { key?: string }) => h?.key?.trim())
      .map((h: { key: string; value?: string }) => ({ key: h.key.trim(), value: h.value ?? '' }));

    setProducing(true);
    try {
      const result = await produceMessage(selectedCluster.id, selectedTopic, {
        key: values.key?.trim() || undefined,
        value: values.value,
        partition: values.partition,
        headers: headers.length > 0 ? headers : undefined,
      });
      message.success(
        t('messageViewer.produceSuccess', {
          partition: result.partition,
          offset: result.offset.toLocaleString(),
        }),
      );
      setProduceOpen(false);
      if (searched) {
        handleSearch();
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : t('messageViewer.produceFailed'));
    } finally {
      setProducing(false);
    }
  };

  const sortBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 12,
    width: 12,
    minWidth: 12,
    minHeight: 12,
    padding: 0,
    margin: 0,
    lineHeight: 1,
    color: active ? token.colorPrimary : token.colorTextQuaternary,
  });

  const columns: ResizableColumn<MessageRecord>[] = [
    {
      title: t('common.partition'),
      dataIndex: 'partition',
      key: 'partition',
      width: 90,
    },
    {
      title: t('consumerGroupDetail.offset'),
      dataIndex: 'offset',
      key: 'offset',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('messageViewer.key'),
      dataIndex: 'key',
      key: 'key',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('messageViewer.value'),
      dataIndex: 'value',
      key: 'value',
      width: 360,
      ellipsis: true,
      render: (value: string | undefined, record: MessageRecord) => {
        const text = value ?? '';
        return (
          <Space
            size={4}
            align="start"
            style={{ cursor: 'pointer', width: '100%' }}
            title={t('messageViewer.clickValueHint')}
            onClick={() => setDetailMessage(record)}
          >
            {record.isJson && <Tag color="blue">JSON</Tag>}
            {!!record.headers?.length && (
              <Tag color="purple">
                {record.headers.length} {t('messageViewer.headers')}
              </Tag>
            )}
            <Text
              ellipsis={{ tooltip: text }}
              style={{ flex: 1, minWidth: 0, color: token.colorPrimary }}
            >
              {text.length > 200 ? text.substring(0, 200) + '...' : text || '-'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            lineHeight: 1,
          }}
        >
          <span>{t('messageViewer.timestamp')}</span>
          <span
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<CaretUpOutlined style={{ fontSize: 10 }} />}
              style={sortBtnStyle(timestampSort === 'asc')}
              title={t('messageViewer.sortAsc')}
              aria-label={t('messageViewer.sortAsc')}
              onClick={() => setTimestampSort('asc')}
            />
            <Button
              type="text"
              size="small"
              icon={<CaretDownOutlined style={{ fontSize: 10 }} />}
              style={sortBtnStyle(timestampSort === 'desc')}
              title={t('messageViewer.sortDesc')}
              aria-label={t('messageViewer.sortDesc')}
              onClick={() => setTimestampSort('desc')}
            />
          </span>
        </span>
      ),
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 200,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <div>
      <h2>{t('messageViewer.title')}</h2>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 250 }}
          placeholder={t('messageViewer.selectTopic')}
          value={selectedTopic}
          onChange={setSelectedTopic}
          options={topics.map((topic) => ({ label: topic.name, value: topic.name }))}
          showSearch
          filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
        />
        <InputNumber
          placeholder={t('common.partition')}
          min={0}
          value={partition}
          onChange={(v) => setPartition(v ?? undefined)}
          style={{ width: 120 }}
        />
        <InputNumber
          placeholder={t('messageViewer.startOffset')}
          value={startOffset}
          onChange={(v) => setStartOffset(v ?? undefined)}
          style={{ width: 140 }}
        />
        <InputNumber
          placeholder={t('messageViewer.limit')}
          min={1}
          max={100}
          value={limit}
          onChange={(v) => setLimit(v || 20)}
          style={{ width: 100 }}
        />
        <Input
          placeholder={t('messageViewer.valueFilter')}
          value={valueFilter}
          onChange={(e) => setValueFilter(e.target.value)}
          style={{ width: 180 }}
          allowClear
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading} disabled={!selectedTopic}>
          {t('common.search')}
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleSearch} disabled={!selectedTopic} />
        <Button icon={<SendOutlined />} onClick={openProduceModal} disabled={!selectedTopic}>
          {t('messageViewer.produce')}
        </Button>
        <Dropdown
          menu={{
            items: [
              { key: 'json', label: t('messageViewer.exportJson') },
              { key: 'csv', label: t('messageViewer.exportCsv') },
            ],
            onClick: ({ key }) => handleExport(key as MessageExportFormat),
          }}
          disabled={!searched || sortedMessages.length === 0}
        >
          <Button icon={<DownloadOutlined />}>{t('messageViewer.export')}</Button>
        </Dropdown>
      </Space>

      {loading && <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />}
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      {!loading && searched && !error && messageList.length === 0 && (
        <Alert
          type="info"
          message={t('messageViewer.noMessages')}
          description={t('messageViewer.noMessagesHint')}
          style={{ marginBottom: 16 }}
        />
      )}

      {!loading && sortedMessages.length > 0 && (
        <ResizableTable
          columns={columns}
          dataSource={sortedMessages}
          rowKey={(r) => `${r.partition}-${r.offset}`}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      )}

      <Modal
        title={t('messageViewer.detailTitle')}
        open={detailMessage !== null}
        onCancel={() => setDetailMessage(null)}
        width={760}
        footer={
          detailMessage
            ? [
                <Button key="copy-key" icon={<CopyOutlined />} onClick={() => copyToClipboard(detailMessage.key)}>
                  {t('messageViewer.copyKey')}
                </Button>,
                <Button
                  key="copy-headers"
                  icon={<CopyOutlined />}
                  disabled={!detailMessage.headers?.length}
                  onClick={() => copyToClipboard(formatHeadersForCopy(detailMessage.headers ?? []))}
                >
                  {t('messageViewer.copyHeaders')}
                </Button>,
                <Button key="copy-value" type="primary" icon={<CopyOutlined />} onClick={() => copyToClipboard(detailMessage.value)}>
                  {t('messageViewer.copyValue')}
                </Button>,
                <Button key="copy-all" icon={<CopyOutlined />} onClick={() => copyToClipboard(formatMessageForCopy(detailMessage))}>
                  {t('messageViewer.copyAll')}
                </Button>,
              ]
            : null
        }
      >
        {detailMessage && (
          <>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label={t('common.partition')}>{detailMessage.partition}</Descriptions.Item>
              <Descriptions.Item label={t('consumerGroupDetail.offset')}>{detailMessage.offset.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label={t('messageViewer.timestamp')} span={2}>
                {new Date(detailMessage.timestamp).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('messageViewer.key')} span={2}>
                <Text copyable={{ text: detailMessage.key, tooltips: [t('messageViewer.copy'), t('messageViewer.copied')] }}>
                  {emptyDisplay(detailMessage.key)}
                </Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Text strong>{t('messageViewer.headers')}</Text>
              {detailMessage.headers?.length ? (
                <ResizableTable<MessageHeader>
                  style={{ marginTop: 8 }}
                  size="small"
                  bordered
                  pagination={false}
                  rowKey={(row, index) => `${row.key}-${index}`}
                  dataSource={detailMessage.headers}
                  columns={
                    [
                      {
                        title: t('messageViewer.key'),
                        dataIndex: 'key',
                        key: 'key',
                        width: 180,
                        ellipsis: true,
                      },
                      {
                        title: t('messageViewer.value'),
                        dataIndex: 'value',
                        key: 'value',
                        width: 420,
                        ellipsis: true,
                        render: (v: string, row: MessageHeader) => (
                          <Space size={4}>
                            {row.encoding === 'base64' && (
                              <Tag color="orange">{t('messageViewer.headerEncodingBase64')}</Tag>
                            )}
                            <Text
                              copyable={{ text: v, tooltips: [t('messageViewer.copy'), t('messageViewer.copied')] }}
                              ellipsis={{ tooltip: v }}
                              style={{ maxWidth: '100%' }}
                            >
                              {emptyDisplay(v)}
                            </Text>
                          </Space>
                        ),
                      },
                    ] satisfies ResizableColumn<MessageHeader>[]
                  }
                />
              ) : (
                <div style={{ marginTop: 8, color: token.colorTextSecondary }}>{t('messageViewer.noHeaders')}</div>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <Space style={{ marginBottom: 8 }}>
                <Text strong>{t('messageViewer.value')}</Text>
                {detailMessage.isJson && <Tag color="blue">JSON</Tag>}
              </Space>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  maxHeight: 420,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  background: token.colorFillAlter,
                  borderRadius: token.borderRadius,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {detailMessage.value}
              </pre>
            </div>
          </>
        )}
      </Modal>

      <Modal
        title={t('messageViewer.produceTitle')}
        open={produceOpen}
        onCancel={() => setProduceOpen(false)}
        onOk={handleProduce}
        confirmLoading={producing}
        width={640}
        destroyOnClose
        okText={t('messageViewer.produce')}
      >
        <Form form={produceForm} layout="vertical">
          <Form.Item name="key" label={t('messageViewer.produceKey')}>
            <Input />
          </Form.Item>
          <Form.Item
            name="value"
            label={t('messageViewer.produceValue')}
            rules={[{ required: true, message: t('messageViewer.produceValueRequired') }]}
          >
            <Input.TextArea rows={8} placeholder={t('messageViewer.produceValue')} />
          </Form.Item>
          <Form.Item name="partition" label={t('messageViewer.producePartition')}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder={t('common.partition')} />
          </Form.Item>
          <Form.Item label={t('messageViewer.produceHeaders')}>
            <Form.List name="headers">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item {...restField} name={[name, 'key']} style={{ marginBottom: 0, flex: 1 }}>
                        <Input placeholder={t('messageViewer.headerKey')} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'value']} style={{ marginBottom: 0, flex: 2 }}>
                        <Input placeholder={t('messageViewer.headerValue')} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    {t('messageViewer.addHeader')}
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MessageViewer;
