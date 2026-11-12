;name my88
;author Magnus Paulsson
;strategy Quick and dirty, time to get back to work.
;strategy Less than perfect :-)
;assert 1
; KOFACOTO 2

data    equ     3
dec     equ     0

i for 8
cc&i    mov     data, <-10+dec-(i-1)*1000
	jmp     -1,<-10+5334+dec-159*i
	dat	#0,#0
	dat	#0,#0
	dat	#0,#0
	dat	#0,#0
	dat	#0,#0
rof
start
i for 7
	spl	cc&i,<23+1000*i
rof
i for 1
	jmp	cc&i+7*7,<-243
rof
end start 
