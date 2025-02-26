import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from "react-redux";
import {RootState} from "typesafe-actions";
import {actions as eventActions} from '../store/event';
import {Container} from "../components/Container";
import {Alert, Card, Col, Input, Row, Select, Space, Table, Typography,} from "antd";
import {Event} from "../store/event/types";
import {filter} from "lodash";
import tableSpin from "../components/Spin";
import {useGetAccessTokenSilently} from "../utils/token";
import UserUpdate from "../components/UserUpdate";
import {useOidcUser} from "@axa-fr/react-oidc";
import {capitalize, formatDateTime} from "../utils/common";
import {User} from "../store/user/types";

const {Title, Paragraph, Text} = Typography;
const {Column} = Table;

interface EventDataTable extends Event {
}

export const Activity = () => {
    const {getAccessTokenSilently} = useGetAccessTokenSilently()
    const {oidcUser} = useOidcUser();
    const dispatch = useDispatch()

    const events = useSelector((state: RootState) => state.event.data);
    const failed = useSelector((state: RootState) => state.event.failed);
    const loading = useSelector((state: RootState) => state.event.loading);
    const users = useSelector((state: RootState) => state.user.data);
    const setupKeys = useSelector((state: RootState) => state.setupKey.data);

    const [textToSearch, setTextToSearch] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [dataTable, setDataTable] = useState([] as EventDataTable[]);
    const pageSizeOptions = [
        {label: "5", value: "5"},
        {label: "10", value: "10"},
        {label: "15", value: "15"},
        {label: "20", value: "20"}
    ]

    const transformDataTable = (d: Event[]): EventDataTable[] => {
        return d.map(p => ({key: p.id, ...p} as EventDataTable))
    }

    useEffect(() => {
        dispatch(eventActions.getEvents.request({getAccessTokenSilently: getAccessTokenSilently, payload: null}));
    }, [])
    useEffect(() => {
        setDataTable(transformDataTable(events))
    }, [events])

    useEffect(() => {
        setDataTable(transformDataTable(filterDataTable()))
    }, [textToSearch])

    const filterDataTable = (): Event[] => {
        const t = textToSearch.toLowerCase().trim()
        let usrsMatch: User[] = filter(users, (u: User) => (u.name)?.toLowerCase().includes(t) || (u.email)?.toLowerCase().includes(t)) as User[]
        let f: Event[] = filter(events, (f: Event) =>
            ((f.activity || f.id).toLowerCase().includes(t) || t === "" || usrsMatch.find(u => u.id === f.initiator_id))
        ) as Event[]
        return f
    }

    const onChangeTextToSearch = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setTextToSearch(e.target.value)
    };

    const searchDataTable = () => {
        const data = filterDataTable()
        setDataTable(transformDataTable(data))
    }

    const onChangePageSize = (value: string) => {
        setPageSize(parseInt(value.toString()))
    }

    const getActivityRow = (group:string,text:string) => {
        return <Row> <Text>Group <Text type="secondary">{group}</Text> {text}</Text> </Row>
    }

    const renderActivity = (event: EventDataTable) => {
        let body = <Text>{event.activity}</Text>
        switch (event.activity_code) {
            case "peer.group.add":
                return getActivityRow(event.meta.group,"added to peer")
            case "peer.group.delete":
                return getActivityRow(event.meta.group,"removed from peer")
            case "user.group.add":
                return getActivityRow(event.meta.group,"added to user")
            case "user.group.delete":
                return getActivityRow(event.meta.group,"removed from user")
            case "setupkey.group.add":
                return getActivityRow(event.meta.group,"added to setup key")
            case "setupkey.group.delete":
                return getActivityRow(event.meta.group,"removed setup key")
            case "dns.setting.disabled.management.group.add":
                return getActivityRow(event.meta.group,"added to disabled management DNS setting")
            case "dns.setting.disabled.management.group.delete":
                return getActivityRow(event.meta.group,"removed from disabled management DNS setting")
        }
        return body
    }
    const renderInitiator = (event: EventDataTable) => {
        let body = <></>
        const user = users?.find(u => u.id === event.initiator_id)
        switch (event.activity_code) {
            case "setupkey.peer.add":
                const key = setupKeys?.find(k => k.id === event.initiator_id)
                if (key) {
                    body = <span style={{height: "auto", whiteSpace: "normal", textAlign: "left"}}>
                                <Row> <Text>{key.name}</Text> </Row>
                                <Row> <Text type="secondary">Setup Key</Text> </Row>
                            </span>
                }
                break
            default:
                if (user) {
                    body = <span style={{height: "auto", whiteSpace: "normal", textAlign: "left"}}>
                                    <Row> <Text>{user.name ? user.name : user.id}</Text> </Row>
                                    <Row> <Text type="secondary">{user.email ? user.email : "User"}</Text> </Row>
                            </span>
                    return body
                }
        }


        return body
    }

    const renderMultiRowSpan = (primaryRowText:string,secondaryRowText:string) => {
        return <span style={{height: "auto", whiteSpace: "normal", textAlign: "left"}}>
                            <Row> <Text>{primaryRowText}</Text> </Row>
                            <Row> <Text type="secondary">{secondaryRowText}</Text> </Row>
               </span>
    }

    const renderTarget = (event: EventDataTable) => {
        if (event.activity_code === "account.create" || event.activity_code === "user.join") {
            return "-"
        }
        const user = users?.find(u => u.id === event.target_id)
        switch (event.activity_code) {
            case "account.create":
            case "user.join":
                return "-"
            case "rule.add":
            case "rule.delete":
            case "rule.update":
                return renderMultiRowSpan(event.meta.name,"Rule")
            case "setupkey.add":
            case "setupkey.revoke":
            case "setupkey.update":
            case "setupkey.overuse":
                let cType:string
                cType = capitalize(event.meta.type)
                return renderMultiRowSpan(event.meta.name,cType+" setup key "+event.meta.key)
            case "group.add":
            case "group.update":
                return renderMultiRowSpan(event.meta.name,"Group")
            case "nameserver.group.add":
            case "nameserver.group.update":
            case "nameserver.group.delete":
                return renderMultiRowSpan(event.meta.name,"Nameserver group")
            case "setupkey.peer.add":
            case "user.peer.add":
            case "user.peer.delete":
            case "peer.ssh.enable":
            case "peer.ssh.disable":
            case "peer.rename":
                return renderMultiRowSpan(event.meta.fqdn,event.meta.ip)
            case "route.add":
            case "route.delete":
            case "route.update":
                return renderMultiRowSpan(event.meta.name, "Route for range " + event.meta.network_range)
            case "user.group.add":
            case "user.group.delete":
                if (user) {
                    return renderMultiRowSpan(user.name ? user.name : user.id,user.email ? user.email : "User")
                }
                return "n/a"
            case "setupkey.group.add":
            case "setupkey.group.delete":
                return renderMultiRowSpan(event.meta.setupkey,"Setup Key")
            case "peer.group.add":
            case "peer.group.delete":
                return renderMultiRowSpan(event.meta.peer_fqdn,event.meta.peer_ip)
            case "dns.setting.disabled.management.group.add":
            case "dns.setting.disabled.management.group.delete":
            case "account.setting.peer.login.expiration.enable":
            case "account.setting.peer.login.expiration.disable":
            case "account.setting.peer.login.expiration.update":
                return renderMultiRowSpan("","System setting")
            case "user.invite":
                if (user) {
                    return renderMultiRowSpan(user.name ? user.name : user.id,user.email ? user.email : "User")
                }
        }

        return event.target_id
    }

    return (
        <>
            <Container style={{paddingTop: "40px"}}>
                <Row>
                    <Col span={24}>
                        <Title level={4}>Activity</Title>
                        <Paragraph>Here you can see all the account and network activity events</Paragraph>
                        <Space direction="vertical" size="large" style={{display: 'flex'}}>
                            <Row gutter={[16, 24]}>
                                <Col xs={24} sm={24} md={8} lg={8} xl={8} xxl={8} span={8}>
                                    <Input allowClear value={textToSearch} onPressEnter={searchDataTable}
                                           placeholder="Search..." onChange={onChangeTextToSearch}/>
                                </Col>
                                <Col xs={24} sm={24} md={11} lg={11} xl={11} xxl={11} span={11}>
                                    <Space size="middle">
                                        <Select value={pageSize.toString()} options={pageSizeOptions}
                                                onChange={onChangePageSize} className="select-rows-per-page-en"/>
                                    </Space>
                                </Col>
                            </Row>
                            {failed &&
                                <Alert message={failed.message} description={failed.data ? failed.data.message : " "}
                                       type="error" showIcon
                                       closable/>
                            }
                            <Card bodyStyle={{padding: 0}}>
                                <Table
                                    pagination={{
                                        pageSize,
                                        showSizeChanger: false,
                                        showTotal: ((total, range) => `Showing ${range[0]} to ${range[1]} of ${total} users`)
                                    }}
                                    className="card-table"
                                    showSorterTooltip={false}
                                    scroll={{x: true}}
                                    loading={tableSpin(loading)}
                                    dataSource={dataTable}
                                    size="small"
                                >
                                    <Column title="Timestamp" dataIndex="timestamp"
                                            render={(text, record, index) => {
                                                return formatDateTime(text)
                                            }}
                                    />
                                    <Column title="Activity" dataIndex="activity"
                                            render={(text, record, index) => {
                                                return renderActivity(record as EventDataTable)
                                            }}
                                    />
                                    <Column title="Initiated By" dataIndex="initiator_id"
                                            render={(text, record, index) => {
                                                return renderInitiator(record as EventDataTable)
                                            }}
                                    />
                                    <Column title="Target" dataIndex="target_id"
                                            render={(text, record, index) => {
                                                return renderTarget(record as EventDataTable)
                                            }}
                                    />
                                </Table>
                            </Card>
                        </Space>
                    </Col>
                </Row>
            </Container>
            <UserUpdate/>
        </>
    )
}

export default Activity;