;redcode
;name Ties R Us
;author Joonas Pihlaja
;assert 1
;stragegy for redcoder's frenzy round 10

	PIN	31

tie3	spl	1
	spl	1
	spl	@ 0 , > 445
	mov	} -1 , > -1
	mov	} -2 , > -2
	spl	@ 0 , > 153
	mov	} -1 , > -1
	mov	ii , } 445
ii	mov.i	# 548 , 1


z for 18-CURLINE
 dat 1,1
 rof


go	ldp	#32,	1
	jmz	tie3,	#0

end go

#END WARRIOR
