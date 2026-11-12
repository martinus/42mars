;redcode-94
;name L0L1
;author Jakub Kozisek
;strategy :-p
;assert 1
	
start1	spl	start5
start2	mov.i	nostart, @nostart+10
start3	mov.i	nostart, *nostart+26
start4  mov.i	nostart, <nostart+37
start5	spl	start10, {nostart+42
start6  mov.i	nostart, <nostart+56
start7  mov.i	nostart, {nostart+68
start8  mov.i	nostart, <nostart+73
start9  mov.i	nostart, {nostart+92
start10	spl	start15, <nostart+102
start11 mov.i	nostart, {nostart+108
start12 mov.i	nostart, <nostart+113
start13 mov.i	nostart, {nostart+125
start14 mov.i	nostart, <nostart+136
start15 spl	start19, {nostart+140
start16 mov.i	nostart, <nostart+147
start17 mov.i	nostart, {nostart+152
start18 mov.i	nostart, <nostart+163
start19	jmp	start1,  *nostart+180
nostart dat	<267, {534

end start1
