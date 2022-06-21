const fetch = require("node-fetch");

async function ExecuteGraphql(cookie, baseUrl, payload) {
    const graphqlEndpoint = new URL("/graphql", baseUrl)

    const response = await fetch(graphqlEndpoint.toString(), {
        "headers": {
            "content-type": "application/json",
            "cookie": `${cookie}`,
        },
        "body": JSON.stringify(payload),
        "method": "POST"
    });
    if (Math.floor(response.status / 100) !== 2) {
        throw new Error(JSON.stringify(await response.json()));
    }
    return (await response.json()).data
}

async function CreateInvite(cookie, baseUrl) {
    const createInvitePayload = {
        "operationName": "createInvite",
        "variables": {
            "invite": {
                "is_valid": true
            }
        },
        "query": "mutation createInvite($invite: InviteInput!) {\n  createInvite(invite: $invite) {\n    hash\n    __typename\n  }\n}\n"
    };

    return (await ExecuteGraphql(cookie, baseUrl, createInvitePayload)).createInvite;
}

async function GetOrganizations(cookie, baseUrl) {
    const getOrganizationsPayload = {
        "operationName": "getOrganizations",
        "variables": {},
        "query": `query getOrganizations {
      organizations {
        id
        name
        campaignsCount
        theme
        settings { featuresJSON }  
      }
    }`};

    return (await ExecuteGraphql(cookie, baseUrl, getOrganizationsPayload)).organizations
}

async function GetCurrentUser(cookie, baseUrl) {
    const getCurrentUser = { "operationName": "getCurrentUser", "variables": {}, "query": "query getCurrentUser {\n  currentUser {\n    id\n    is_superadmin\n    __typename\n  }\n}\n" };

    return (await ExecuteGraphql(cookie, baseUrl, getCurrentUser)).currentUser;
}

async function GetInvite(cookie, baseUrl, hash) {
    const getInvitePayloadGenerator = (hash) => ({
        "operationName": "getInvite",
        "variables": {
            "inviteId": hash
        },
        "query": "query getInvite($inviteId: String!) {\n  inviteByHash(hash: $inviteId) {\n    id\n    isValid\n    __typename\n  }\n}\n"
    });

    return (await ExecuteGraphql(cookie, baseUrl, getInvitePayloadGenerator(hash))).inviteByHash;
}

async function CreateOrganization(cookie, baseUrl, name, userId, inviteId) {
    const createOrganizationGenerator = (name, userId, inviteId) => ({
        "operationName": "createOrganization",
        "variables": {
            "name": name,
            "userId": userId,
            "inviteId": inviteId
        },
        "query": "mutation createOrganization($name: String!, $userId: String!, $inviteId: String!) {\n  createOrganization(name: $name, userId: $userId, inviteId: $inviteId) {\n    id\n    __typename\n  }\n}\n"
    });

    return (await ExecuteGraphql(cookie, baseUrl, createOrganizationGenerator(name, userId, inviteId))).createOrganization;
}

async function UpdateOrganization(cookie, baseUrl, organizationId, input) {
    const updateOrganizationGenerator = (organizationId, input) => ({
        "operationName": "editOrganization",
        "variables": {
            "id": organizationId,
            "organization": input,
        },
        "query": "mutation editOrganization($id: String!, $organization: OrganizationInput!) {\n  editOrganization(id: $id, organization: $organization) {\n    id\n settings { featuresJSON }     }\n}\n"
    });

    return (await ExecuteGraphql(cookie, baseUrl, updateOrganizationGenerator(organizationId, input))).editOrganization;
}

async function UpdateTwilio(cookie, baseUrl, organizationId, twilioAccountSid, twilioAuthToken, twilioMessageServiceSid) {
    const updateTwilioGenerator = (organizationId, twilioAccountSid, twilioAuthToken, twilioMessageServiceSid) => ({
        "operationName": "updateServiceVendorConfig",
        "variables": {
            "organizationId": organizationId,
            "serviceName": "twilio",
            "config": JSON.stringify(
                {
                    twilioAccountSid,
                    twilioAuthToken,
                    twilioMessageServiceSid: twilioMessageServiceSid || twilioAccountSid
                })
        },
        "query": "mutation updateServiceVendorConfig($organizationId: String!, $serviceName: String!, $config: JSON!) {\n  updateServiceVendorConfig(organizationId: $organizationId, serviceName: $serviceName, config: $config) {\n    id\n    config\n    __typename\n  }\n}\n"
    });

    return (await ExecuteGraphql(cookie, baseUrl, updateTwilioGenerator(organizationId, twilioAccountSid, twilioAuthToken, twilioMessageServiceSid))).updateServiceVendorConfig;
}

class SpokeClient {
    constructor(baseUrl, jwt) {
        this.baseUrl = baseUrl;
        this.jwt = jwt;
    }
    async _getCookie() {
        if (!this.__cookie) {
            const cookies = await fetch(new URL('/login-callback', this.baseUrl), {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${this.jwt}`
                },
                redirect: 'manual',
            }).then(r => r.headers.raw()).then(h => h['set-cookie'].map(c => c.split(';')[0]));

            this.__cookie = cookies.join(";")
        }

        return this.__cookie;
    }
    CreateInvite = async () => CreateInvite(await this._getCookie(), this.baseUrl);
    GetOrganizations = async () => GetOrganizations(await this._getCookie(), this.baseUrl);
    GetCurrentUser = async () => GetCurrentUser(await this._getCookie(), this.baseUrl);
    GetInvite = async (hash) => GetInvite(await this._getCookie(), this.baseUrl, hash);
    CreateOrganization = async (name) => {
        const { id: userId } = await this.GetCurrentUser();
        const { hash: invitationHash } = await this.CreateInvite();
        const [{ id: inviteId },] = await this.GetInvite(invitationHash);

        console.log(userId, invitationHash, inviteId);

        return CreateOrganization(
            await this._getCookie(),
            this.baseUrl,
            name,
            userId,
            inviteId,
        );
    };
    UpdateOrganization = async (organizationId, input) => UpdateOrganization(await this._getCookie(), this.baseUrl, organizationId, input);
    UpdateTwilio = async (organizationId, twilioAccountSid, twilioAuthToken, twilioMessageServiceSid) => UpdateTwilio(await this._getCookie(), this.baseUrl, organizationId, twilioAccountSid, twilioAuthToken, twilioMessageServiceSid);
}

module.exports = {
    SpokeClient
}