;redcode-lp
;name Archbishop II, no P-s
;author G.Labarga
;assert CORESIZE==8000 && MAXPROCESSES==8
; versión mejorada; optimizar

gate equ train- (83 %1000)	;30
where equ (4148 %5000)	;2002

train:	mov.i bm,<gate
	djn.f *1,<gate
	jmp #-2,<gate
for 50
	dat 0,0
rof
bm:	dat <1,{1
for 138
	dat 0,0
rof
boot:
aimp:	mov.i #1,*1
	spl where,<where
	spl train,{0
bimp:	mov.i #1,1

	end boot


