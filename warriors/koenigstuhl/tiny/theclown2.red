;redcode-tiny
;name The clown 2
;author Neo
;assert 1
;strategy Qbomb->paper/imp

	dest equ 60 ;(1660 %800)
;	QGAP EQU 23 ;7

;QBOMB:				;The Quick punch :)
;I FOR 11
;	MOV.I {QBOMB-40-(2*I*QGAP),<QBOMB-40-((2*I+1)*QGAP)
;ROF
gate equ cl-3
cl:	;spl 0,0
	spl #0,{gate
	mov cbm,>gate
	djn.f -1,>gate
cbm:	dat {267,<8
for 4
	dat 0,0
rof
start:	mov <clgo,{clgo
	;mov <clgo,{clgo
launch:	spl 2,{-40-(24*23)
	spl 1,<-40-(25*23)
	mov <clgo,{clgo
clgo:	spl *137,cl+4	;157
	spl 1,{-40-(26*23)

	spl @0,<dest
	mov }-1,>-1
	spl @0,<268
	mov }-1,>-1
	mov.i #267,}400
	mov.i #267,*0
end start	;QBOMB
