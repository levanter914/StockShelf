'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, firestore, storage } from '@/app/firebase/config';
import { Box, Modal, Typography, Stack, TextField, Button, Select, MenuItem, InputLabel, FormControl } from '@mui/material';
import { collection, deleteDoc, doc, getDocs, query, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [open, setOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('name-asc');
  const [image, setImage] = useState(null);
  const [selectedItemImage, setSelectedItemImage] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Check user authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        updateInventory();
      } else {
        router.push('/sign-in');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Update inventory from Firestore
  const updateInventory = async () => {
    const snapshot = query(collection(firestore, 'inventory'));
    const docs = await getDocs(snapshot);
    const inventoryList = [];
    docs.forEach((doc) => {
      inventoryList.push({
        name: doc.id,
        ...doc.data(),
      });
    });
    setInventory(inventoryList);
    applyFiltersAndSorting(inventoryList);
  };

  // Apply search and sorting
  const applyFiltersAndSorting = (inventoryList) => {
    let filtered = inventoryList;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sorting
    if (sortOption === 'quantity-asc') {
      filtered = filtered.sort((a, b) => a.quantity - b.quantity);
    } else if (sortOption === 'quantity-desc') {
      filtered = filtered.sort((a, b) => b.quantity - a.quantity);
    } else if (sortOption === 'name-asc') {
      filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption === 'name-desc') {
      filtered = filtered.sort((a, b) => b.name.localeCompare(a.name));
    }

    setFilteredInventory(filtered);
  };

  // Handle user logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/sign-in');
    } catch (error) {
      console.error("Error logging out: ", error);
    }
  };

  // Open and close modals
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const handleImageModalOpen = () => setImageModalOpen(true);
  const handleImageModalClose = () => setImageModalOpen(false);

  // Add new item to inventory
  const addItem = async (item, qty, imageFile) => {
    if (!item || qty <= 0) return;

    let imageUrl = '';
    if (imageFile) {
      try {
        const imageRef = ref(storage, `inventory/${item}-${Date.now()}`);
        await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(imageRef);
      } catch (error) {
        console.error("Error uploading image:", error);
      }
    }

    const docRef = doc(collection(firestore, 'inventory'), item);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const { quantity } = docSnap.data();
      await setDoc(docRef, { quantity: quantity + qty, imageUrl }, { merge: true });
    } else {
      await setDoc(docRef, { quantity: qty, imageUrl });
    }
    await updateInventory();
  };

  // Delete item
  const removeItem = async (item) => {
    const docRef = doc(collection(firestore, 'inventory'), item);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const { quantity } = docSnap.data();
      if (quantity === 1) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, { quantity: quantity - 1 }, { merge: true });
      }
    }
    await updateInventory();
  };

  // Delete everything
  const removeAll = async (item) => {
    try {
      const docRef = doc(collection(firestore, 'inventory'), item);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await deleteDoc(docRef);
      }
      await updateInventory();
    } catch (error) {
      console.error("Error removing item: ", error);
    }
  };

  // Handle item name click to view image
  const handleItemNameClick = async (name) => {
    const docRef = doc(collection(firestore, 'inventory'), name);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().imageUrl) {
      setSelectedItemImage(docSnap.data().imageUrl);
      handleImageModalOpen();
    }
  };

  useEffect(() => {
    if (user) {
      updateInventory();
    }
  }, [user]);

  useEffect(() => {
    applyFiltersAndSorting(inventory);
  }, [inventory, searchQuery, sortOption]);

  if (!user) {
    return null; 
  }

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      p={2}
      bgcolor="#f5f5f5"
      boxSizing="border-box"
      overflow="auto"
    >
      {/* Top Bar */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
        flexWrap="wrap"
      >
        <Typography variant="h4"
          color="#2e085c"
          sx={{ 
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)' }}>
          Welcome to Stock Shelf!
        </Typography>
        <Button
          variant="outlined"
          color="secondary"
          onClick={handleLogout}
          sx={{
            borderColor: '#4a148c',
            color: '#4a148c',
            '&:hover': {
              backgroundColor: '#4a148c',
              color: 'white',
            },
            mr: 1,
          }}
        >
          Logout
        </Button>
      </Box>

      {/* Controls and List */}
      <Box
        display="flex"
        flexDirection="column"
        gap={2}
        alignItems="center"
        width="100%"
        maxWidth="1200px"
        margin="0 auto"
      >
        {/* Controls */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
          maxWidth="1200px"
          mb={2}
        >
          <Button
            variant="contained"
            sx={{
              backgroundColor: '#4a148c',
              '&:hover': {
                backgroundColor: '#3a106c',
              },
            }}
            onClick={handleOpen}
          >
            Add New Item
          </Button>

          <Box display="flex" alignItems="center" gap={2}>
            <TextField
              label="Search"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mr: 2 }}
            />
            <FormControl variant="outlined" size="small">
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                label="Sort By"
              >
                <MenuItem value="name-asc">Name (A-Z)</MenuItem>
                <MenuItem value="name-desc">Name (Z-A)</MenuItem>
                <MenuItem value="quantity-asc">Quantity (Low to High)</MenuItem>
                <MenuItem value="quantity-desc">Quantity (High to Low)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Inventory List */}
        <Box
          width="100%"
          bgcolor="#ffffff"
          borderRadius="8px"
          boxShadow={3}
          overflow="auto"
        >
          <Stack
            direction="row"
            spacing={0}
            bgcolor="#4a148c"
            color="#fff"
            padding={1}
            borderRadius="8px 8px 0 0"
            justifyContent="space-between"
            alignItems="center"
            px={2}
          >
            <Box flex={1}>
              <Typography variant="h6" textAlign="left">Item Name</Typography>
            </Box>
            <Box flex={0.5}>
              <Typography variant="h6" textAlign="center">Quantity</Typography>
            </Box>
            <Box flex={0.75}>
              <Typography variant="h6" textAlign="center">Actions</Typography>
            </Box>
          </Stack>
          <Stack spacing={1}>
            {filteredInventory.map(({ name, quantity, imageUrl }) => (
              <Box
                key={name}
                width="100%"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                bgcolor="#a281c9"
                padding={2}
                borderBottom="1px solid #ddd"
              >
                <Box flex={1}>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      textDecoration: imageUrl ? 'underline' : 'none', 
                      cursor: imageUrl ? 'pointer' : 'default' 
                    }}
                    onClick={() => imageUrl && handleItemNameClick(name)}
                  >
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </Typography>
                </Box>
                <Box flex={0.5}>
                  <Typography variant="body1" textAlign="center">{quantity}</Typography>
                </Box>
                <Box flex={0.75} display="flex" justifyContent="center">
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      sx={{ backgroundColor: '#4a148c', '&:hover': { backgroundColor: '#3a106c' } }}
                      onClick={() => addItem(name, 1)}
                    >
                      +
                    </Button>
                    <Button
                      variant="contained"
                      sx={{ backgroundColor: '#4a148c', '&:hover': { backgroundColor: '#3a106c' } }}
                      onClick={() => removeItem(name)}
                    >
                      -
                    </Button>
                    <Button
                      variant="contained"
                      sx={{ backgroundColor: '#4a148c', '&:hover': { backgroundColor: '#3a106c' } }}
                      onClick={() => removeAll(name)}
                    >
                      Remove All
                    </Button>
                  </Stack>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Modal for Adding Items */}
      <Modal open={open} onClose={handleClose}>
        <Box
          position="absolute"
          top="50%"
          left="50%"
          width={400}
          bgcolor="white"
          border="2px solid #00000"
          boxShadow={24}
          p={4}
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap={3}
          sx={{ transform: "translate(-50%, -50%)" }}
        >
          <Typography variant="h6">Add Items</Typography>
          <Stack width="100%" spacing={2}>
            <TextField
              variant="outlined"
              label="Item Name"
              fullWidth
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
            <TextField
              variant="outlined"
              label="Quantity"
              type="number"
              fullWidth
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              inputProps={{ min: 1 }} // Ensure quantity is at least 1
            />
            <Button
              variant="contained"
              component="label"
              sx={{
                backgroundColor: '#4a148c',
                '&:hover': {
                  backgroundColor: '#3a106c',
                },
              }}
            >
              Upload Image
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setImage(e.target.files[0]);
                  }
                }}
              />
            </Button>
            <Button
              variant="contained"
              sx={{
                backgroundColor: '#4a148c',
                '&:hover': {
                  backgroundColor: '#3a106c',
                },
              }}
              onClick={() => {
                if (itemName && quantity > 0) {
                  addItem(itemName, quantity, image);
                  setItemName('');
                  setQuantity(1); 
                  setImage(null); 
                  handleClose();
                }
              }}
            >
              Add
            </Button>
          </Stack>
        </Box>
      </Modal>

      {/* Modal for Viewing Item Image */}
      <Modal open={imageModalOpen} onClose={handleImageModalClose}>
        <Box
          position="absolute"
          top="50%"
          left="50%"
          width={400}
          bgcolor="white"
          border="2px solid #00000"
          boxShadow={24}
          p={4}
          display="flex"
          flexDirection="column"
          alignItems="center"
          sx={{ transform: "translate(-50%, -50%)" }}
        >
          {selectedItemImage ? (
            <img
              src={selectedItemImage}
              alt="Item Image"
              style={{ width: '100%', borderRadius: '8px' }}
            />
          ) : (
            <Typography>No Image Available</Typography>
          )}
        </Box>
      </Modal>
    </Box>
  );
}
