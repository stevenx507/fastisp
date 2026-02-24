from datetime import date

from flask_jwt_extended import create_access_token

from app import db
from app.models import Invoice, PaymentRecord, Subscription, User


def _admin_token(app, email: str) -> str:
    with app.app_context():
        user = User(email=email, role='admin', name='Admin Jobs')
        user.set_password('adminpass123')
        db.session.add(user)
        db.session.commit()
        return create_access_token(identity=str(user.id))


def test_system_job_recalc_balances_updates_invoice_status(client, app):
    token = _admin_token(app, 'jobs-admin-1@test.local')

    with app.app_context():
        subscription = Subscription(
            customer='Balance Customer',
            email='balance@test.local',
            plan='Mensual',
            cycle_months=1,
            amount=45.0,
            status='active',
            currency='USD',
            next_charge=date.today(),
            method='manual',
        )
        db.session.add(subscription)
        db.session.flush()

        invoice = Invoice(
            subscription_id=subscription.id,
            amount=45.0,
            currency='USD',
            tax_percent=0,
            total_amount=45.0,
            status='pending',
            due_date=date.today(),
        )
        db.session.add(invoice)
        db.session.flush()

        payment = PaymentRecord(
            invoice_id=invoice.id,
            method='manual',
            reference='job-recalc-paid',
            amount=45.0,
            currency='USD',
            status='paid',
        )
        db.session.add(payment)
        db.session.commit()
        invoice_id = invoice.id

    response = client.post(
        '/api/admin/system/jobs/run',
        json={'job': 'recalc_balances'},
        headers={'Authorization': f'Bearer {token}'},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    assert payload['job']['status'] == 'completed'
    assert payload['job']['result']['updated'] >= 1

    with app.app_context():
        updated_invoice = db.session.get(Invoice, invoice_id)
        assert updated_invoice is not None
        assert updated_invoice.status == 'paid'


def test_ops_run_job_rotate_passwords_returns_skipped_status(client, app):
    token = _admin_token(app, 'jobs-admin-2@test.local')

    response = client.post(
        '/api/ops/run-job',
        json={'job': 'rotate_passwords'},
        headers={'Authorization': f'Bearer {token}'},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    assert payload['job']['status'] == 'skipped'
    assert 'message' in payload['job']['result']


def test_system_jobs_history_includes_finished_result(client, app):
    token = _admin_token(app, 'jobs-admin-3@test.local')

    run_response = client.post(
        '/api/admin/system/jobs/run',
        json={'job': 'rotate_passwords'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert run_response.status_code == 200

    history_response = client.get(
        '/api/admin/system/jobs/history?limit=5',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert history_response.status_code == 200
    payload = history_response.get_json()
    assert payload['count'] >= 1
    assert payload['items'][0]['job'] == 'rotate_passwords'
    assert payload['items'][0]['status'] == 'skipped'
    assert 'finished_at' in payload['items'][0]
    assert isinstance(payload['items'][0].get('result'), dict)

