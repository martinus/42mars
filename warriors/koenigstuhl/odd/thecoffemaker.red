;redcode-lp
;name The coffe maker
;author G.Labarga
;assert 1
;strategy RF19 entry #2
;strategy paper
;strategy Poorly optimized :(

	pst1 equ 656
	pst2 equ 2708
	atk1 equ 6124
	padd equ 2132
	gate equ ptr-3

ptr:	mov #8,#8
	add.a #padd,one
copy:	mov <ptr,{one
	mov bmb,>atk1
	jmn copy,ptr
	spl @ptr,<gate
one:	jmp @pst1,<gate
bmb:	dat <1,{1

ptrb:	mov #8,#8
	add.a #padd,two
copyb:	mov <ptrb,{two
	mov bmbb,>atk1
	jmn copyb,ptrb
	spl @ptrb,<gate
two:	jmp @pst2,<gate
bmbb:	dat <1,{1

start:	spl copy,<gate-6
	jmp copyb,<gate-6
	dat 1,1
	dat 1,1

	end start



