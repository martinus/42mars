;redcode
;author Lukasz Adamowski
;strategy Wait till being bombed, then run survived decrement stream
;assert 1

start jmz 4, c1
jmz 4, c2
jmz $-2, #0
jmz 0, 0
jmz 2, <2
jmz 2, <2
jmz -2, {-100
jmz -2, {-100
jmz 0, 0
jmz 0, 0
jmz 0, 0
c1 jmz 1, 1
c2 jmz 1, 1

end start