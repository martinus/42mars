;redcode
;name Seven Nation Army
;author Sascha Zapf
;       CORESIZE==2520
;assert 1
; First Entry for IRCT13


clear spl #0,#0
mov.i bomb, {bptr
mov.i bomb, {bptr
djn.b -2, <-1200
bomb dat.f -20,0
bptr dat.f -20,0
qbomb
n for 20
mov.i <50+(125*n),<100+(125*n)
rof

boot mov.i }bootptr,>bootptr
djn.b boot, #6
jmp clear+200
bootptr dat.f clear, clear+200
end qbomb
