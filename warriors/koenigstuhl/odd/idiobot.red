;redcode-lp
;name Idiobot
;author G.Labarga
;assert 1
;strategy RF19 entry #1
;strategy paper

	pst equ 4811	;3700
	scnd equ 1774 ;4000
	atk1 equ 46557
	atk2 equ 4705
	padd equ 1441
	gate equ ptr-3

start:	spl 1,ptr+10		;(works as imp-gate too)
for 5
	mov <start,<sprd
rof
sprd:	djn.a @1,#scnd		;launches a second copy

ptr:	mov #10,#10
	add.a #padd,one
copy:	mov <ptr,{one
	mov <ptr,{one
	mov bmb,>atk1
	mov bmb,<atk2
	jmn copy,ptr
	spl @ptr,<gate
one:	jmp @pst,<gate
bmb:	dat <1,{1
for 3
	dat 1,1
rof
	end start


