;redcode
;name Serenade v6
;author Daniel Rivas
;strategy SPL bomber with DJN stream -> Core clear
;assert 1

bmb	SPL #2000, {-4
loop	ADD #3044, ptr
	MOV bmb, @ptr
	DJN loop, {-4
clear	MOV 1, <-1
	DAT 0, 0
	DAT 0, 0
ptr	DAT 0, 0

