/*
 * Squidex Headless CMS
 *
 * @license
 * Copyright (c) Squidex UG (haftungsbeschränkt). All rights reserved.
 */

import { Injectable } from '@angular/core';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';

import '@app/framework/utils/rxjs-extensions';

import {
    DialogService,
    ImmutableArray,
    Form,
    State,
    ValidatorsEx,
    Version
} from '@app/framework';

import { AppsState } from './apps.state';

import {
    AppClientDto,
    AppClientsService,
    CreateAppClientDto,
    UpdateAppClientDto
} from './../services/app-clients.service';

export class AttachClientForm extends Form<FormGroup> {
    public hasNoName =
        this.form.controls['name'].valueChanges.startWith('').map(x => !x || x.length === 0);

    constructor(formBuilder: FormBuilder) {
        super(formBuilder.group({
            name: ['',
                [
                    Validators.maxLength(40),
                    ValidatorsEx.pattern('[a-z0-9]+(\-[a-z0-9]+)*', 'Name can contain lower case letters (a-z), numbers and dashes (not at the end).')
                ]
            ]
        }));
    }
}

interface Snapshot {
    clients: ImmutableArray<AppClientDto>;

    isLoaded: boolean;

    version: Version;
}

@Injectable()
export class ClientsState extends State<Snapshot> {
    public clients =
        this.changes.map(x => x.clients);

    public isLoaded =
        this.changes.map(x => x.isLoaded);

    constructor(
        private readonly appClientsService: AppClientsService,
        private readonly appsState: AppsState,
        private readonly dialogs: DialogService
    ) {
        super({ clients: ImmutableArray.empty(), version: new Version(''), isLoaded: false });
    }

    public load(): Observable<any> {
        return this.appClientsService.getClients(this.appName)
            .do(dtos => {
                this.next(s => {
                    const clients = ImmutableArray.of(dtos.clients);

                    return { ...s, clients, isLoaded: true, version: dtos.version };
                });
            })
            .notify(this.dialogs);
    }

    public attach(request: CreateAppClientDto): Observable<any> {
        return this.appClientsService.postClient(this.appName, request, this.snapshot.version)
            .do(dto => {
                this.next(s => {
                    const clients = s.clients.push(dto.payload);

                    return { ...s, clients, version: dto.version };
                });
            })
            .notify(this.dialogs);
    }

    public revoke(client: AppClientDto): Observable<any> {
        return this.appClientsService.deleteClient(this.appName, client.id, this.snapshot.version)
            .do(dto => {
                this.next(s => {
                    const clients = s.clients.filter(c => c.id !== client.id);

                    return { ...s, clients, version: dto.version };
                });
            })
            .notify(this.dialogs);
    }

    public update(client: AppClientDto, request: UpdateAppClientDto): Observable<any> {
        return this.appClientsService.putClient(this.appName, client.id, request, this.snapshot.version)
            .do(dto => {
                this.next(s => {
                    const clients = s.clients.replaceBy('id', update(client, request));

                    return { ...s, clients, version: dto.version };
                });
            })
            .notify(this.dialogs);
    }

    private get appName() {
        return this.appsState.appName;
    }
}

const update = (client: AppClientDto, request: UpdateAppClientDto) =>
    new AppClientDto(client.id, request.name || client.name, client.secret, request.permission || client.permission);