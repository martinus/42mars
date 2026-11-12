;redcode-rf23
;name castle of mirrors
;author John Metcalf
;strategy written in 5 minutes, untested
;assert 1

from:mov #8,#0
     add.a #12345, to
copy:mov <from,{to
     mov 50,<-2000
     mov 50,<-4000
     jmn copy, from
     spl from, <-6000
to:  jmp 8000, <-8000

end from
