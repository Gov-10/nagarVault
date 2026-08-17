# NagarVault
An air-gapped, Privacy-First Civic Data Operating Layer for Municipal Intelligence
## Unique Features
1. Built for secure municipal servers, this stack runs locally on a k8s cluster, without any cloud dependency
2. This project will be available as a helm chart
## Architecture Diagram
![System Architecture](./docs/arc.png)
## Tech stack:
1. Backend services: FastAPI
2. Queue system: Kafka
3. Deployment: Helm, k8s
4. Object storage: MinIO
5. Databases: PostgreSQL
6. Vector store: QDrant
7. API Gateway: KONG
8. Logs store: ElasticSearch
9. Metrics store: Prometheus
10. Frontend: NextJS
