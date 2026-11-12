;recode-94b
;name Twins
;strategy Imp twins
;author Arivaalli
;assert 1

start
loop for 10
mov.i imp,(loop*200)+100
mov.i imp+1,(loop*200)+100
spl (loop*200)+98
mov.i imp,(loop*221)-150;
mov.i imp+1,(loop*301)-150;
spl (loop*300)-152
mov.i imp,(loop*251)/2
mov.i imp,(loop*251)/2
spl ((loop*251)/2)-2
rof
imp  
mov 0,2
mov 0,2
end



