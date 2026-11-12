;redcode-88
;name NeoCLP
;author G.Labarga
;assert 1
;strategy	CLP

	dest equ 2048+1

sptr:	mov #bmb+1,@0	;bmb+1
setf:	mov #0,bmb+28
tweak:	sub #dest,bmb
chk:	mov bmb,<bmb	;sptr-2
	jmz chk,@setf
copy:	mov <sptr,<ptr
	jmn copy,sptr
ptr:	jmp @0,dest
bmb:	dat <2667,<-500 ;1
i for 60
	dat #-i,<1
rof
boot: 	mov <src,<go
blop: 	mov <src,<go
 	mov <src,<go
 	mov <src,<go
 	mov <src,<go
src:	jmn blop,bmb+1
go:	djn sptr-1022,#sptr-1013

	end boot	;sptr
