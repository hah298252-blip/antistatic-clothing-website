import Lanyard from './Lanyard'
import { useNavigate } from 'react-router-dom'
import './LanyardCards.css'
import employee1 from '../../assert/employee1.png'
import employee2 from '../../assert/employee2.png'
import employee3 from '../../assert/employee3.png'
import employee4 from '../../assert/employee4.png'
import employeeBack from '../../assert/employee_back.png'

export default function LanyardCards({ visible = true }) {
  const navigate = useNavigate()

  return (
    <div className={`lanyardCards${visible ? ' lanyardCards--visible' : ''}`} aria-label="三个可拖动的挂绳卡片" aria-hidden={!visible}>
      <Lanyard
        position={[0, 0, 20]}
        gravity={[0, -40, 0]}
        cards={[
          { frontImage: employee1, backImage: employeeBack, anchor: [-5.4, 0, 0] },
          { frontImage: employee2, backImage: employeeBack, anchor: [-1.8, 0, 0] },
          { frontImage: employee3, backImage: employeeBack, anchor: [1.8, 0, 0] },
          { frontImage: employee4, backImage: employeeBack, anchor: [5.4, 0, 0], onDragEnd: () => navigate('/contact?type=hr') },
        ]}
      />
    </div>
  )
}
