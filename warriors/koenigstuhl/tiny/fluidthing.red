;redcode-tiny
;name Fluid thing
;author G.Labarga
;assert CORESIZE==800
;strategy paper/imp/clear
;TL5's paper/imp

dest equ 75
src equ 684
dst equ 26
gate equ clr-95

clr:	spl #0,<gate
	mov <gate,<gate
	djn.f -1,<gate
for 7
	dat 0,0
rof
start:	spl 2,<11
	spl 1,{13
	spl clr,<17
	spl 1,>15

	spl @0,<dest
	mov }-1,>-1
	spl @0,<268
	mov }-1,>-1
	mov.i #src,}dst
imp:	mov.i #267,*0
end start
