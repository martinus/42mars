;redcode-94x
;name the paper without a name
;author John Metcalf
;strategy Paper for IRCT07
;assert 1
; CORESIZE==800

      add.a #7,    sp1   ; setup :-)
      mov   sp1,   sp2
      mov   sp1,   sp3
      mov   sp1,   {sp3
      mov   sp1,   sp5
      add.a #68,   sp4
      add.a #420,  sp5
      
sp1:  spl   -5,    0     ; spl 2
sp2:  dat   0,     0     ; spl 2
sp3:  dat   0,     0     ; spl 1

sp4:  dat   0,     0     ; spl 70,  0
      mov   >sp4,  }sp4
sp5:  dat   0,     0     ; spl 422, 0
      mov   >sp5,  }sp5  
      mov.i #-43,  }422
     end

