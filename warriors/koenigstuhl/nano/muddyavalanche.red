;redcode-nano
;name muddy avalanche 
;author G.Labarga
;assert CORESIZE==80
;strategy Qscan->clear
;strategy New constants, different attack

x equ 33
y equ 66
d1 equ ptr+(x*y)-5
d2 equ ptr+(x*y)
d3 equ ptr+(x-6)

start:	sne.i d1,d2
	seq.i {ptr,d3
ptr:	mul.x #x,#y
clr:	mov >-8,<ptr
	djn.f clr,}ptr
end start
