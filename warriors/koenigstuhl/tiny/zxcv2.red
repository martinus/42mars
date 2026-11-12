;redcode-tiny
;name zxc v2
;author G.Labarga
;assert CORESIZE==800
;strategy bomber/imp

step equ 705
d1 equ (hit+(2*step))
decoy equ bmb-110
istep equ 267
iloc equ start+40

bmb:	mov step,1
head:	spl #0,<decoy
ref:	mov bmb,*d1
	mov bmb,@ref
	add #(2*step),ref
hit:	djn.f ref,<decoy
for 6
	dat 0,0
rof
start:	spl head,<decoy-1
	mov imp,@first
	spl 1		,>iloc+(6*istep)
	spl 1		,>iloc+(4*istep)
	spl 2		,>iloc+(2*istep)
first:	djn.a >first	,#iloc+(0*istep)
	djn.a @first+1	,#iloc+(1*istep)
imp:	mov.i #istep,*0

end start
