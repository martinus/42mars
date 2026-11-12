;redcode-94x
;name LV Stone
;author John Metcalf
;strategy extremely poor stone
;strategy Redcoders' Frenzy Limited-Value Round
;assert 1
; CORESIZE==55440

     add.f @1,   @1
     add.f 1,    1

     spl   #1,   <-1
     add   -1,   1
     mov   >0,   1
     djn   -1,   #1

     dat   {-1,  }0
     end
