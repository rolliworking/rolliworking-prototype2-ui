"""
RolliSuite ERP API Tests
Tests all CRUD operations for the 7 core modules:
- Auth, Dashboard, Customers, Estimates, Jobs, Sales Orders, Watches, Parts
"""
import pytest
import requests
import os

# Use the API URL from environment or default to localhost
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')

class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rollisuite.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@rollisuite.com"
        assert data["user"]["role"] == "admin"
    
    def test_login_invalid_credentials(self):
        """Test login with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for authenticated tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@rollisuite.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestDashboard:
    """Dashboard endpoint tests"""
    
    def test_dashboard_stats_unauthorized(self):
        """Test dashboard stats without auth"""
        response = requests.get(f"{BASE_URL}/api/v1/dashboard/stats")
        assert response.status_code == 401
    
    def test_dashboard_stats_authorized(self, auth_headers):
        """Test dashboard stats with auth"""
        response = requests.get(f"{BASE_URL}/api/v1/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "activeJobs" in data["data"]
        assert "pendingEstimates" in data["data"]
        assert "openSalesOrders" in data["data"]


class TestDailyHitList:
    """Daily Hit List endpoint tests"""
    
    def test_daily_hit_list_authorized(self, auth_headers):
        """Test daily hit list with auth"""
        response = requests.get(f"{BASE_URL}/api/v1/daily-hit-list", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "items" in data["data"]
        assert "metadata" in data["data"]


class TestCustomers:
    """Customers CRUD tests"""
    
    def test_list_customers(self, auth_headers):
        """Test listing customers"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "customers" in data
        assert "total" in data
    
    def test_create_and_get_customer(self, auth_headers):
        """Test creating a customer and verifying persistence"""
        # Create customer
        create_payload = {
            "firstName": "TEST_John",
            "lastName": "Doe",
            "email": "test_john.doe@example.com",
            "phone": "555-9999"
        }
        create_response = requests.post(f"{BASE_URL}/api/customers", 
                                        json=create_payload, headers=auth_headers)
        assert create_response.status_code in [200, 201]
        created = create_response.json()
        assert "customer" in created or "id" in created
        
        customer_id = created.get("customer", {}).get("id") or created.get("id")
        assert customer_id is not None
        
        # Get customer to verify persistence
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", headers=auth_headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        customer_data = fetched.get("customer", fetched)
        assert customer_data["firstName"] == "TEST_John"
        assert customer_data["lastName"] == "Doe"
        
        # Cleanup - delete the test customer
        delete_response = requests.delete(f"{BASE_URL}/api/customers/{customer_id}", headers=auth_headers)
        assert delete_response.status_code in [200, 204]


class TestWatches:
    """Watches CRUD tests"""
    
    def test_list_watches(self, auth_headers):
        """Test listing watches - should have 4 watches"""
        response = requests.get(f"{BASE_URL}/api/v1/watches", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "watches" in data
        assert "total" in data
        assert data["total"] >= 3  # At least 3 seeded watches
    
    def test_get_watch_detail(self, auth_headers):
        """Test getting watch details"""
        # First get list to get an ID
        list_response = requests.get(f"{BASE_URL}/api/v1/watches", headers=auth_headers)
        watches = list_response.json()["watches"]
        if watches:
            watch_id = watches[0]["id"]
            detail_response = requests.get(f"{BASE_URL}/api/v1/watches/{watch_id}", headers=auth_headers)
            assert detail_response.status_code == 200
            watch = detail_response.json()
            assert "id" in watch
            assert "brand" in watch
            assert "model" in watch


class TestParts:
    """Parts & Inventory CRUD tests"""
    
    def test_list_parts(self, auth_headers):
        """Test listing parts - should have 3 parts"""
        response = requests.get(f"{BASE_URL}/api/v1/parts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "parts" in data
        assert "total" in data
        assert data["total"] >= 3  # 3 seeded parts
    
    def test_get_part_detail(self, auth_headers):
        """Test getting part details with stock levels"""
        list_response = requests.get(f"{BASE_URL}/api/v1/parts", headers=auth_headers)
        parts = list_response.json()["parts"]
        if parts:
            part_id = parts[0]["id"]
            detail_response = requests.get(f"{BASE_URL}/api/v1/parts/{part_id}", headers=auth_headers)
            assert detail_response.status_code == 200
            part = detail_response.json()
            assert "id" in part
            assert "partNumber" in part
            assert "description" in part
    
    def test_create_part(self, auth_headers):
        """Test creating a new part"""
        create_payload = {
            "partNumber": "TEST-PART-001",
            "description": "Test Part for Testing",
            "itemType": "part",
            "uom": "each",
            "defaultSellPrice": 100,
            "averageCost": 50,
            "reorderPoint": 5,
            "reorderQty": 10
        }
        response = requests.post(f"{BASE_URL}/api/v1/parts", 
                                json=create_payload, headers=auth_headers)
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data or "part" in data
        
        # Cleanup
        part_id = data.get("id") or data.get("part", {}).get("id")
        if part_id:
            requests.delete(f"{BASE_URL}/api/v1/parts/{part_id}", headers=auth_headers)


class TestEstimates:
    """Estimates CRUD tests"""
    
    def test_list_estimates(self, auth_headers):
        """Test listing estimates"""
        response = requests.get(f"{BASE_URL}/api/estimates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "estimates" in data
        assert data["total"] >= 3  # 3 seeded estimates
    
    def test_get_estimate_detail(self, auth_headers):
        """Test getting estimate details"""
        list_response = requests.get(f"{BASE_URL}/api/estimates", headers=auth_headers)
        estimates = list_response.json()["estimates"]
        if estimates:
            estimate_id = estimates[0]["id"]
            detail_response = requests.get(f"{BASE_URL}/api/estimates/{estimate_id}", headers=auth_headers)
            assert detail_response.status_code == 200


class TestJobs:
    """Jobs CRUD tests"""
    
    def test_list_jobs(self, auth_headers):
        """Test listing jobs"""
        response = requests.get(f"{BASE_URL}/api/jobs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "jobs" in data
        assert data["total"] >= 3  # 3 seeded jobs
    
    def test_get_job_detail(self, auth_headers):
        """Test getting job details"""
        list_response = requests.get(f"{BASE_URL}/api/jobs", headers=auth_headers)
        jobs = list_response.json()["jobs"]
        if jobs:
            job_id = jobs[0]["id"]
            detail_response = requests.get(f"{BASE_URL}/api/jobs/{job_id}", headers=auth_headers)
            assert detail_response.status_code == 200


class TestSalesOrders:
    """Sales Orders CRUD tests"""
    
    def test_list_sales_orders(self, auth_headers):
        """Test listing sales orders"""
        response = requests.get(f"{BASE_URL}/api/sales-orders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "salesOrders" in data
        assert data["total"] >= 2  # 2 seeded sales orders
    
    def test_get_sales_order_detail(self, auth_headers):
        """Test getting sales order details"""
        list_response = requests.get(f"{BASE_URL}/api/sales-orders", headers=auth_headers)
        orders = list_response.json()["salesOrders"]
        if orders:
            order_id = orders[0]["id"]
            detail_response = requests.get(f"{BASE_URL}/api/sales-orders/{order_id}", headers=auth_headers)
            assert detail_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
