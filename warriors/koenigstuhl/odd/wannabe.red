;redcode-88odd
;name Wanna be a porn star
;author G.Labarga
;assert CORESIZE==8000
;strategy R18 entry #1
;strategy Backwards linear scan: spl bomb or vamp to imp launcher -> clear
;strategy v2: switch to clear/imp if our opponent is a bomber

	gate equ bm-5

bm:	spl 0,1
atk:	mov bm,@ptr
	mov bm,<ptr
	jmn atk,<ptr
scan:	jmz 0,<ptr
	jmn atk,<ptr
	add #1,ptr
	sub ptr,vbmb
	mov vbmb,@ptr
	mov #pit-vbmb,vbmb	;reset bomb
	djn chk,#4
	spl clr-2
	jmp pit
chk:	djn scan,ptr

	spl 0,<gate
	spl 0,<gate
clr:	mov cbm,<cpt
	mov cbm,<cpt
	mov cbm,<cpt
	djn clr,<gate ;cpt
;dat <2667,<clr-cpt-5
cbm:	dat <2667,<clr-cpt-4
	dat #0,#0
cpt:	dat #0,<clr-124
	dat #0,#0
ptr:	dat #0,<atk-80
vbmb:	jmp @0,pit-ptr
	dat #0,#0
	dat #0,#0
	dat #0,#0
	dat #0,#0

pit:	spl 1,<gate
	spl 1,<gate
	spl 0,<gate	;just an imp-pump
	add #2667,igo
	djn @igo,<gate ;cpt
igo:	dat #0,#imp-(4*2667)
imp:	mov 0,2667

	end scan



