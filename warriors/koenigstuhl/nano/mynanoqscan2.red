;redcode-nano
;name My nano Qscan II
;author G.Labarga
;assert CORESIZE==80
;strategy new patern

x equ 33
y equ 66
d1 equ ptr+(x*y)-5
d2 equ ptr+(x*y)
d3 equ ptr+(x-1)-5

start:	sne.i d1,d2
	seq.i {ptr,d3
ptr:	mul.x #x,#y
clr:	mov <45,<ptr
	djn.f clr,{clr

end start

