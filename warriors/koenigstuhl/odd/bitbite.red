;redcode
;name Bit&Bite
;author B. Cook
; bpc25@cam.ac.uk
;strategy step 5 spl bomber -> dat clear
;assert 1

org start

start    spl    1,    >1
spl    1,    }1
jmp    >0,    1
spl    #0,    -1
sub.b    @-1,    #1
mov.i    *-1,    @-1
jmp    *-1,    0
mov.i    >1,    @1
jmp    -1,    1
dat    }1,    }1

end
