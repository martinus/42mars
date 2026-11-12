;redcode-88
;name NeoCLPb
;author G.Labarga
;assert 1
;strategy	CLP

	dest equ 2048+1

mptr:	mov #last+1,@last+1
setr:	mov #0,setf-34+1
setf:	mov #0,last+38
chk:	mov vbmb,<vbmb
	sub 1,vbmb
	jmn mdfy,@setf
	jmz chk,@setr
mdfy:	mov last+1,vbmb
copy:	mov <mptr,<ptr
	jmn copy,mptr
ptr:	jmp @0,dest
vbmb:	jmp -3,5
pit:	spl 0,<1	;setf-35
	jmp 1,1001	;stp #0,#1000 ;...
last:	mov 2,<-1
	
	;jmp pit,<setf-35

	end setr
