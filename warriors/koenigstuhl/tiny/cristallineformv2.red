;redcode-tiny
;name Cristalline form v2
;author G.Labarga
;assert CORESIZE==800
;strategy stone/imp
;strategy Stone from Smart cabrio by Lachi
;strategy bah!

iloc equ imp+40
istep equ 267
step equ 2505

sto:	spl #step,<-step
	add.x sto,1
	mov >0-step,-3+step
	djn.f -2,<sto-step
for 8-1
	dat 0,0
rof
start:	spl sto,{0
	spl sto+2,{0
	mov imp,iloc
	spl 1		,}iloc+(6*istep)
	spl 1		,}iloc+(4*istep)
	spl 2		,}iloc+(2*istep)
first:	djn.a >first	,#iloc+(0*istep)
	djn.a @first+1	,#iloc+(1*istep)
imp:	mov.i #istep,*0
end start
